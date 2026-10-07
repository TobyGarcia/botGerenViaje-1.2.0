import test from "node:test";
import assert from "node:assert/strict";
import { databasePool } from "../database/pool.js";
import { createTrip } from "../services/viajes.service.js";

test("dos solicitudes simultáneas crean un solo viaje pendiente", async (t) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const ids = {};

  await databasePool.query(`INSERT INTO estados_viaje (nombre, descripcion, activo)
    VALUES ('PENDIENTE','Prueba de concurrencia',TRUE)
    ON CONFLICT (nombre) DO UPDATE SET activo=TRUE`);
  ids.driver = (await databasePool.query(`INSERT INTO conductores
    (nombre, licencia_numero, licencia_vigente, licencia_vencimiento, activo)
    VALUES ($1,$2,TRUE,CURRENT_DATE + 30,TRUE) RETURNING id_conductores`,
  [`PRUEBA CONCURRENCIA ${suffix}`, `LIC-${suffix}`])).rows[0].id_conductores;
  ids.vehicle = (await databasePool.query(`INSERT INTO vehiculos
    (nombre, numero_economico, kilometraje_actual, activo, en_mantenimiento, id_conductor_asignado)
    VALUES ($1,$2,1000,TRUE,FALSE,$3) RETURNING id_vehiculos`,
  [`UNIDAD PRUEBA ${suffix}`, `TEST-${suffix}`, ids.driver])).rows[0].id_vehiculos;
  ids.origin = (await databasePool.query(`INSERT INTO lugares (nombre, activo)
    VALUES ($1,TRUE) RETURNING id_lugares`, [`ORIGEN PRUEBA ${suffix}`])).rows[0].id_lugares;
  ids.destination = (await databasePool.query(`INSERT INTO lugares (nombre, activo)
    VALUES ($1,TRUE) RETURNING id_lugares`, [`DESTINO PRUEBA ${suffix}`])).rows[0].id_lugares;

  t.after(async () => {
    const trips = (await databasePool.query(
      "SELECT id_viajes FROM viajes WHERE id_conductores=$1", [ids.driver])).rows.map(r => r.id_viajes);
    if (trips.length) {
      await databasePool.query("DELETE FROM historial_estados_viaje WHERE id_viajes=ANY($1::int[])", [trips]);
      await databasePool.query("DELETE FROM historial_kilometraje_vehiculos WHERE id_viajes=ANY($1::int[])", [trips]);
      await databasePool.query("DELETE FROM viajes WHERE id_viajes=ANY($1::int[])", [trips]);
    }
    await databasePool.query("DELETE FROM vehiculos WHERE id_vehiculos=$1", [ids.vehicle]);
    await databasePool.query("DELETE FROM conductores WHERE id_conductores=$1", [ids.driver]);
    await databasePool.query("DELETE FROM lugares WHERE id_lugares=ANY($1::int[])", [[ids.origin, ids.destination]]);
  });

  const payload = {
    idConductor: ids.driver,
    idVehiculo: ids.vehicle,
    idOrigen: ids.origin,
    idDestino: ids.destination,
    acompanantes: [],
    kilometrajeInicial: 1000,
    motivo: "Prueba ficticia de reintento",
    esGerenciamiento: true
  };
  const [first, second] = await Promise.all([createTrip(payload), createTrip(payload)]);

  assert.equal(first.id_viajes, second.id_viajes);
  assert.equal(Boolean(first.reused) || Boolean(second.reused), true);
  const total = await databasePool.query(
    "SELECT COUNT(*)::int total FROM viajes WHERE id_conductores=$1", [ids.driver]);
  assert.equal(total.rows[0].total, 1);

  await assert.rejects(createTrip({ ...payload, motivo: "Solicitud diferente" }),
    /Ya tienes el viaje .* pendiente/);
});
