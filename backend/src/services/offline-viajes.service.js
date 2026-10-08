import { createHash } from "node:crypto";
import { databasePool } from "../database/pool.js";
import { cancelExpiredPendingTrips, createTrip, startTrip, finishTrip } from "./viajes.service.js";
import { calculateValidityStatus } from "./manejo-comentado.service.js";
import { mexicoClock, signOfflinePermit, verifyOfflinePermit } from "../utils/offline-trip-permit.js";
import { normalizeInitialTripLocation } from "./initial-trip-location.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const goodStatus = value => ["VIGENTE", "PROXIMO_A_VENCER"].includes(value);
const allowedInspection = value => ["APROBADA", "PENDIENTE_APROBACION"].includes(value);

async function checkDriving(client, driverId, at) {
  const { rows } = await client.query(`SELECT c.fecha_manejo_comentado, e.fecha_evaluacion,
    e.calificacion, e.estado_evaluacion FROM conductores c
    LEFT JOIN LATERAL (SELECT fecha_evaluacion, calificacion, estado_evaluacion
      FROM evaluaciones_manejo_comentado WHERE id_conductores=c.id_conductores
      ORDER BY fecha_evaluacion DESC, (estado_evaluacion='REPROBADO') DESC LIMIT 1) e ON TRUE
    WHERE c.id_conductores=$1`, [driverId]);
  const r = rows[0];
  return r && goodStatus(calculateValidityStatus(r.fecha_evaluacion || r.fecha_manejo_comentado,
    r.calificacion, r.estado_evaluacion, null, at).estado);
}

export async function getOfflinePermits(driverId, now = new Date()) {
  const { day, minutes } = mexicoClock(now);
  if (minutes < 360 || minutes >= 1080 || !(await checkDriving(databasePool, driverId, now))) return [];
  const { rows } = await databasePool.query(`SELECT DISTINCT ON (i.id_vehiculos)
      i.id_inspeccion, i.id_vehiculos, i.estado
    FROM inspecciones_vehiculares i
    JOIN conductores c ON c.id_conductores=i.id_conductores
    JOIN vehiculos vh ON vh.id_vehiculos=i.id_vehiculos
    WHERE i.id_conductores=$1 AND i.fecha_operativa=$2::date
      AND i.creado_en <= $3::timestamptz
      AND c.activo AND c.licencia_vigente AND c.licencia_vencimiento >= $2::date
      AND vh.activo AND NOT vh.en_mantenimiento
      AND NOT EXISTS (
        SELECT 1 FROM viajes uso_posterior
        WHERE uso_posterior.id_vehiculos=i.id_vehiculos
          AND uso_posterior.id_conductores<>i.id_conductores
          AND uso_posterior.hora_salida IS NOT NULL
          AND uso_posterior.hora_salida>i.actualizado_en
      )
      AND (vh.id_conductor_asignado=$1 OR EXISTS (
        SELECT 1 FROM asignaciones_temporales_vehiculo atv
        WHERE atv.id_conductores=$1 AND atv.id_vehiculos=i.id_vehiculos
          AND atv.estado='ACTIVA' AND $2::date BETWEEN atv.fecha_inicio AND atv.fecha_fin
      ))
    ORDER BY i.id_vehiculos, i.creado_en DESC, i.id_inspeccion DESC`, [driverId, day, now.toISOString()]);
  // Mexico City uses UTC-06 year-round; Intl above determines the operational day.
  const exp = Math.floor(+new Date(`${day}T18:00:00-06:00`) / 1000);
  return rows.filter(r => allowedInspection(r.estado)).map(r => {
    const claims = { driverId: Number(driverId), vehicleId: r.id_vehiculos,
      inspectionId: Number(r.id_inspeccion), day, exp };
    return { ...claims, issuedAt: now.toISOString(), expiresAt: new Date(exp * 1000).toISOString(), token: signOfflinePermit(claims, now) };
  });
}

export function validateOfflineRequest(body, driverId, now = new Date()) {
  if (!body || !UUID.test(body.clientId || "")) throw new Error("El identificador local no es válido.");
  const claims = verifyOfflinePermit(body.permit, driverId, body.startedAt, now);
  if (!body.initialLocation) throw new Error("El viaje sin conexión no contiene la primera ubicación GPS.");
  const initialLocation = normalizeInitialTripLocation(body.initialLocation, body.startedAt);
  const p = body.trip || {};
  for (const name of ["idConductor", "idVehiculo", "idOrigen", "idDestino"]) {
    if (!Number.isSafeInteger(p[name]) || p[name] <= 0) throw new Error("Los datos del viaje no son válidos.");
  }
  if (p.idConductor !== Number(driverId) || p.idVehiculo !== claims.vehicleId || p.idOrigen === p.idDestino ||
      !Number.isSafeInteger(p.kilometrajeInicial) || p.kilometrajeInicial < 0 ||
      typeof p.motivo !== "string" || p.motivo.length > 2000 ||
      !Array.isArray(p.acompanantes) || p.acompanantes.length > 30 ||
      p.acompanantes.some(a => typeof a?.nombre !== "string" || a.nombre.length > 150)) {
    throw new Error("El viaje no coincide con el permiso o contiene datos inválidos.");
  }
  if (body.finishedAt && (!Number.isFinite(+new Date(body.finishedAt)) ||
      +new Date(body.finishedAt) < +new Date(body.startedAt) || +new Date(body.finishedAt) > +now + 60000 ||
      !Number.isSafeInteger(body.kilometrajeFinal) || body.kilometrajeFinal <= p.kilometrajeInicial)) {
    throw new Error("La hora o el kilometraje de cierre no son válidos.");
  }
  const trip = Object.fromEntries(["idConductor", "idVehiculo", "idOrigen", "idDestino", "kilometrajeInicial", "motivo", "acompanantes"].map(k => [k, p[k]]));
  const hash = createHash("sha256").update(JSON.stringify({ trip, startedAt: body.startedAt, permit: body.permit, initialLocation })).digest("hex");
  return { claims, trip, hash, initialLocation };
}

export async function syncOfflineTrip(body, driverId) {
  const { claims, trip, hash, initialLocation } = validateOfflineRequest(body, driverId);
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL TIME ZONE 'America/Mexico_City'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('offline:' || $1))", [body.clientId]);
    let row = (await client.query("SELECT * FROM viajes_offline WHERE client_id=$1 FOR UPDATE", [body.clientId])).rows[0];
    if (row && (Number(row.id_conductores) !== Number(driverId) || row.request_hash !== hash)) {
      throw new Error("El identificador ya se utilizó con otros datos.");
    }
    if (!row) {
      // Locks serialize sync with other trips using the same driver/vehicle.
      await client.query("SELECT id_conductores FROM conductores WHERE id_conductores=$1 FOR UPDATE", [driverId]);
      await client.query("SELECT id_vehiculos FROM vehiculos WHERE id_vehiculos=$1 FOR UPDATE", [claims.vehicleId]);
      const inspection = (await client.query(`SELECT i.estado, i.fecha_operativa::text,
          i.id_conductores, i.id_vehiculos, i.creado_en, i.actualizado_en, c.licencia_vencimiento::text
        FROM inspecciones_vehiculares i JOIN conductores c ON c.id_conductores=i.id_conductores
        WHERE i.id_inspeccion=$1 FOR SHARE OF i`, [claims.inspectionId])).rows[0];
      if (!inspection || !allowedInspection(inspection.estado) || inspection.fecha_operativa !== claims.day ||
          Number(inspection.id_conductores) !== Number(driverId) || inspection.id_vehiculos !== claims.vehicleId ||
          !inspection.licencia_vencimiento || inspection.licencia_vencimiento < claims.day ||
          +new Date(inspection.creado_en) > +new Date(body.startedAt)) {
        throw new Error("La inspección previa ya no es válida. El viaje local se conserva para revisión.");
      }
      const laterVehicleUse = await client.query(`SELECT 1 FROM viajes
        WHERE id_vehiculos=$1 AND id_conductores<>$2 AND hora_salida IS NOT NULL
          AND hora_salida>$3::timestamptz AT TIME ZONE 'America/Mexico_City'
          AND hora_salida<$4::timestamptz AT TIME ZONE 'America/Mexico_City'
        LIMIT 1`, [claims.vehicleId, driverId, inspection.actualizado_en, body.startedAt]);
      if (laterVehicleUse.rowCount) {
        throw new Error("Otro conductor utilizó la unidad después de esta inspección. Se requiere una inspección nueva.");
      }
      if (!(await checkDriving(client, driverId, new Date(body.startedAt)))) {
        throw new Error("Se requiere manejo comentado vigente.");
      }
      await cancelExpiredPendingTrips({
        client,
        operationalDate: mexicoClock(new Date()).day,
        idConductor: driverId,
        idVehiculo: claims.vehicleId
      });
      const conflict = await client.query(`SELECT 1 FROM viajes v JOIN estados_viaje e USING(id_estado_viaje)
        WHERE (v.id_conductores=$1 OR v.id_vehiculos=$2) AND
        (e.nombre IN ('PENDIENTE','EN_CURSO') OR
         (v.hora_salida IS NOT NULL AND v.hora_salida < COALESCE($4::timestamptz, CURRENT_TIMESTAMP) AT TIME ZONE 'America/Mexico_City'
          AND COALESCE(v.hora_llegada,v.actualizado_en) > $3::timestamptz AT TIME ZONE 'America/Mexico_City')) LIMIT 1`,
      [driverId, claims.vehicleId, body.startedAt, body.finishedAt || null]);
      if (conflict.rowCount) throw new Error("Hay otro viaje que entra en conflicto. El viaje local se conserva para revisión.");
      const created = await createTrip(trip, { client, recordedAt: body.startedAt });
      await startTrip({ idViaje: created.id_viajes, initialLocation }, { client, recordedAt: body.startedAt });
      row = (await client.query(`INSERT INTO viajes_offline
        (client_id,id_conductores,id_viajes,id_inspeccion,request_hash,inicio_dispositivo)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.clientId, driverId, created.id_viajes, claims.inspectionId, hash, body.startedAt])).rows[0];
    }
    if (body.finishedAt) {
      if (row.fin_dispositivo && (+new Date(row.fin_dispositivo) !== +new Date(body.finishedAt) || row.kilometraje_final !== body.kilometrajeFinal)) {
        throw new Error("El viaje ya se sincronizó con otro cierre.");
      }
      if (!row.fin_dispositivo) {
        await finishTrip({ idViaje: row.id_viajes, kilometrajeFinal: body.kilometrajeFinal }, { client, recordedAt: body.finishedAt });
        await client.query("UPDATE viajes_offline SET fin_dispositivo=$2,kilometraje_final=$3 WHERE client_id=$1", [body.clientId, body.finishedAt, body.kilometrajeFinal]);
      }
    }
    const result = (await client.query(`SELECT v.id_viajes AS "idViaje",v.folio,e.nombre AS estado,
      v.hora_salida AS "horaSalida",v.hora_llegada AS "horaLlegada",v.kilometraje_inicial AS "kilometrajeInicial",
      v.kilometraje_final AS "kilometrajeFinal" FROM viajes v JOIN estados_viaje e USING(id_estado_viaje) WHERE id_viajes=$1`, [row.id_viajes])).rows[0];
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
