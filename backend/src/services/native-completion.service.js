import { createHash } from "node:crypto";
import { databasePool } from "../database/pool.js";
import { finishTrip } from "./viajes.service.js";

export function validateNativeCompletion(body, now = Date.now()) {
  const timestamp = Date.parse(body?.recordedAt);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.clientId || "") ||
      !["finalizado", "cancelado"].includes(body?.action) || !Number.isFinite(timestamp) ||
      timestamp > now + 600000 || timestamp < now - 30 * 86400000 ||
      (body.action === "finalizado" && (!Number.isSafeInteger(body.kilometrajeFinal) || body.kilometrajeFinal < 0))) {
    throw new Error("Los datos de cierre offline no son válidos.");
  }
  return { clientId: body.clientId, action: body.action, recordedAt: new Date(timestamp).toISOString(),
    kilometrajeFinal: body.action === "finalizado" ? body.kilometrajeFinal : null };
}

export async function completeNativeTrip(idViaje, driverId, body) {
  const payload = validateNativeCompletion(body);
  const hash = createHash("sha256").update(JSON.stringify({ idViaje, ...payload })).digest("hex");
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL TIME ZONE 'America/Mexico_City'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`native:${payload.clientId}`]);
    const prior = (await client.query("SELECT * FROM cierres_nativos WHERE client_id=$1", [payload.clientId])).rows[0];
    if (prior) {
      if (Number(prior.id_conductores) !== Number(driverId) || prior.request_hash !== hash) throw new Error("El cierre ya se utilizó con otros datos.");
      await client.query("COMMIT");
      return { trip: prior.resultado, notify: false };
    }
    const trip = (await client.query(`SELECT v.*, e.nombre AS estado, c.nombre AS conductor, vh.nombre AS vehiculo, vh.numero_economico,
      ($2::timestamptz AT TIME ZONE 'America/Mexico_City') >= v.hora_salida AS fecha_valida
      FROM viajes v JOIN estados_viaje e USING(id_estado_viaje) JOIN conductores c USING(id_conductores)
      JOIN vehiculos vh USING(id_vehiculos) WHERE v.id_viajes=$1 FOR UPDATE OF v`, [idViaje, payload.recordedAt])).rows[0];
    if (!trip || Number(trip.id_conductores) !== Number(driverId)) throw new Error("El viaje no pertenece al conductor.");
    if (trip.estado !== "EN_CURSO" || !trip.fecha_valida) throw new Error("El estado o la fecha del viaje requieren revisión.");
    let result;
    if (payload.action === "finalizado") result = await finishTrip({ idViaje, kilometrajeFinal: payload.kilometrajeFinal }, { client, recordedAt: payload.recordedAt });
    else {
      const cancelled = (await client.query("SELECT id_estado_viaje FROM estados_viaje WHERE nombre='CANCELADO' AND activo=TRUE LIMIT 1")).rows[0];
      if (!cancelled) throw new Error("No existe estado CANCELADO.");
      await client.query("UPDATE viajes SET id_estado_viaje=$2, actualizado_en=$3::timestamptz AT TIME ZONE 'America/Mexico_City' WHERE id_viajes=$1", [idViaje, cancelled.id_estado_viaje, payload.recordedAt]);
      await client.query("INSERT INTO historial_estados_viaje(id_viajes,id_estado_anterior,id_estado_nuevo,observaciones) VALUES($1,$2,$3,$4)", [idViaje, trip.id_estado_viaje, cancelled.id_estado_viaje, "Cancelado offline desde Android"]);
      result = { idViaje, folio: trip.folio, estado: "CANCELADO", conductor: trip.conductor, vehiculo: trip.vehiculo, numeroEconomico: trip.numero_economico };
    }
    await client.query("INSERT INTO cierres_nativos(client_id,id_conductores,id_viajes,request_hash,resultado) VALUES($1,$2,$3,$4,$5::jsonb)", [payload.clientId, driverId, idViaje, hash, JSON.stringify(result)]);
    await client.query("COMMIT");
    return { trip: result, notify: true };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
