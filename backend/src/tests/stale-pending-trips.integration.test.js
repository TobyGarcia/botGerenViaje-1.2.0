import test from "node:test";
import assert from "node:assert/strict";
import { databasePool } from "../database/pool.js";
import { cancelExpiredPendingTrips } from "../services/viajes.service.js";

test("cancela solo el pendiente anterior nunca iniciado y registra historial", async (t) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const folioSuffix = `${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 1000)}`;
  const ids = { trips: [] };

  const stateRows = await databasePool.query(`SELECT nombre,id_estado_viaje FROM estados_viaje
    WHERE nombre IN ('PENDIENTE','CANCELADO')`);
  const states = Object.fromEntries(stateRows.rows.map(row => [row.nombre, row.id_estado_viaje]));
  assert.ok(states.PENDIENTE && states.CANCELADO);

  ids.driver = (await databasePool.query(`INSERT INTO conductores
    (nombre,licencia_numero,licencia_vigente,licencia_vencimiento,activo)
    VALUES ($1,$2,TRUE,CURRENT_DATE+30,TRUE) RETURNING id_conductores`,
  [`LIMPIEZA ${suffix}`, `CLEAN-${suffix}`])).rows[0].id_conductores;
  ids.vehicle = (await databasePool.query(`INSERT INTO vehiculos
    (nombre,numero_economico,kilometraje_actual,activo,en_mantenimiento)
    VALUES ($1,$2,100,TRUE,FALSE) RETURNING id_vehiculos`,
  [`UNIDAD LIMPIEZA ${suffix}`, `CLEAN-${suffix}`])).rows[0].id_vehiculos;
  ids.origin = (await databasePool.query("INSERT INTO lugares (nombre,activo) VALUES ($1,TRUE) RETURNING id_lugares",
    [`ORIGEN ${suffix}`])).rows[0].id_lugares;
  ids.destination = (await databasePool.query("INSERT INTO lugares (nombre,activo) VALUES ($1,TRUE) RETURNING id_lugares",
    [`DESTINO ${suffix}`])).rows[0].id_lugares;

  t.after(async () => {
    await databasePool.query("DELETE FROM historial_estados_viaje WHERE id_viajes=ANY($1::int[])", [ids.trips]);
    await databasePool.query("DELETE FROM viajes WHERE id_viajes=ANY($1::int[])", [ids.trips]);
    await databasePool.query("DELETE FROM lugares WHERE id_lugares=ANY($1::int[])", [[ids.origin, ids.destination]]);
    await databasePool.query("DELETE FROM vehiculos WHERE id_vehiculos=$1", [ids.vehicle]);
    await databasePool.query("DELETE FROM conductores WHERE id_conductores=$1", [ids.driver]);
  });

  const insertTrip = async (sequence, date, departure = null) => {
    const row = (await databasePool.query(`INSERT INTO viajes
      (folio,fecha,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,
       acompanantes,licencia_vigente,kilometraje_inicial,motivo,hora_salida)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'[]'::jsonb,TRUE,100,'prueba',$8)
      RETURNING id_viajes`, [
      `TC-${folioSuffix}-${sequence}`, date, ids.driver, ids.vehicle,
      ids.origin, ids.destination, states.PENDIENTE, departure
    ])).rows[0];
    ids.trips.push(row.id_viajes);
    return row.id_viajes;
  };

  const staleNeverStarted = await insertTrip(1, "2026-10-06");
  const currentPending = await insertTrip(2, "2026-10-07");
  const staleStarted = await insertTrip(3, "2026-10-06", "2026-10-06T10:00:00");

  const cancelled = await cancelExpiredPendingTrips({ operationalDate: "2026-10-07" });
  assert.equal(cancelled, 1);

  const rows = await databasePool.query(`SELECT v.id_viajes,e.nombre AS estado,v.hora_salida
    FROM viajes v JOIN estados_viaje e USING(id_estado_viaje)
    WHERE v.id_viajes=ANY($1::int[])`, [ids.trips]);
  const byId = Object.fromEntries(rows.rows.map(row => [row.id_viajes, row]));
  assert.equal(byId[staleNeverStarted].estado, "CANCELADO");
  assert.equal(byId[currentPending].estado, "PENDIENTE");
  assert.equal(byId[staleStarted].estado, "PENDIENTE");

  const history = await databasePool.query(`SELECT observaciones FROM historial_estados_viaje
    WHERE id_viajes=$1 AND id_estado_nuevo=$2`, [staleNeverStarted, states.CANCELADO]);
  assert.equal(history.rowCount, 1);
  assert.match(history.rows[0].observaciones, /nunca fue iniciado/);
});
