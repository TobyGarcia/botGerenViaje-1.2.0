import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { databasePool } from "../database/pool.js";
import { normalizeOdometerCorrection, applyOdometerCorrection } from "../services/odometer-correction.service.js";
import { registerMileageReading } from "../services/kilometraje.service.js";
import { createTrip, startTrip, finishTrip } from "../services/viajes.service.js";
import { odometerCaption, processOdometerAlerts } from "../services/odometer-alerts.service.js";
import { signOfflinePermit } from "../utils/offline-trip-permit.js";
import { validateOfflineRequest } from "../services/offline-viajes.service.js";
const correction = { previousReading: 1000, reason: "Error en lectura anterior", photoBase64: "data:image/jpeg;base64,/9j/2Q==" };

test("valida evidencia, motivo y referencia; nunca habilita lecturas negativas", () => {
  assert.equal(normalizeOdometerCorrection(correction, 900).previousReading, 1000);
  for (const invalid of [{ ...correction, reason: "" }, { ...correction, photoBase64: "data:image/jpeg;base64,YWJj" }, { ...correction, previousReading: 800 }]) {
    assert.throws(() => normalizeOdometerCorrection(invalid, 900));
  }
  assert.throws(() => normalizeOdometerCorrection(correction, -1));
  assert.equal(normalizeOdometerCorrection(null, 900), null);
});

test("la sincronización offline conserva foto y motivo dentro de su clave idempotente", () => {
  const issued = new Date("2026-10-27T11:55:00Z"), startedAt = "2026-10-27T12:00:00Z", now = new Date("2026-10-27T12:01:00Z");
  const claims = { driverId: 7, vehicleId: 9, inspectionId: 11, day: "2026-10-27", exp: Math.floor(+new Date("2026-10-28T00:00:00Z") / 1000) };
  const request = { clientId: randomUUID(), permit: signOfflinePermit(claims, issued), startedAt,
    initialLocation: { clientLocationId: randomUUID(), latitud: 19.83, longitud: -90.52, fechaGps: startedAt },
    trip: { idConductor: 7, idVehiculo: 9, idOrigen: 1, idDestino: 2, kilometrajeInicial: 900, motivo: "Prueba", acompanantes: [], odometerCorrection: correction } };
  const normalized = validateOfflineRequest(request, 7, now);
  assert.deepEqual(normalized.trip.odometerCorrection, correction);
  assert.notEqual(normalized.hash, validateOfflineRequest({ ...request, trip: { ...request.trip, odometerCorrection: { ...correction, reason: "Motivo diferente" } } }, 7, now).hash);
  const legacy = { ...request.trip }; delete legacy.odometerCorrection;
  assert.equal(Object.hasOwn(validateOfflineRequest({ ...request, trip: legacy }, 7, now).trip, "odometerCorrection"), false);
});

test("el ajuste solo se aplica al iniciar, conserva historia y encola Telegram sin duplicar confirmaciones", async () => {
  const driver = (await databasePool.query("INSERT INTO conductores(nombre,licencia_vigente,licencia_vencimiento) VALUES('Odómetro Prueba',TRUE,CURRENT_DATE+30) RETURNING id_conductores")).rows[0].id_conductores;
  const vehicle = (await databasePool.query("INSERT INTO vehiculos(nombre,numero_economico,kilometraje_actual,id_conductor_asignado) VALUES('Unidad Prueba',$1,1000,$2) RETURNING id_vehiculos", [randomUUID(),driver])).rows[0].id_vehiculos;
  const origin = (await databasePool.query("INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares", [randomUUID()])).rows[0].id_lugares;
  const destination = (await databasePool.query("INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares", [randomUUID()])).rows[0].id_lugares;
  await registerMileageReading({ client: databasePool, idVehiculo: vehicle, kilometraje: 1000, tipoRegistro: "MIGRACION", origen: "MIGRACION" });
  const payload = { idConductor: driver, idVehiculo: vehicle, idOrigen: origin, idDestino: destination, acompanantes: [], kilometrajeInicial: 900, motivo: "Prueba", esGerenciamiento: true, odometerCorrection: correction };
  await assert.rejects(createTrip({ ...payload, odometerCorrection: { ...correction, previousReading: 1001 } }), /lectura de la unidad cambió/);
  const created = await createTrip(payload);
  const trip = { ...created, id_vehiculos: vehicle };
  assert.equal(created.kilometrajeInicial, 900);
  assert.equal((await createTrip(payload)).reused, true);
  await assert.rejects(createTrip({ ...payload, odometerCorrection: { ...correction, reason: "Otro motivo" } }), /otro reporte/);
  const client = await databasePool.connect();
  try {
    assert.equal((await client.query("SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1", [vehicle])).rows[0].kilometraje_actual, 1000);
    await client.query("BEGIN");
    assert.equal(await applyOdometerCorrection(client, trip), true);
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1", [vehicle])).rows[0].kilometraje_actual, 1000);
    await client.query("BEGIN");
    await client.query("UPDATE conductores SET fecha_manejo_comentado=CURRENT_DATE WHERE id_conductores=$1", [driver]);
    await startTrip({ idViaje: trip.id_viajes, initialLocation: { clientLocationId: randomUUID(), latitud: 19.83, longitud: -90.52, fechaGps: new Date().toISOString() } }, { client });
    assert.equal(await applyOdometerCorrection(client, trip), false);
    const finished = await finishTrip({ idViaje: trip.id_viajes, kilometrajeFinal: 950 }, { client });
    assert.equal(Number(finished.kilometrosRecorridos), 50);
    await client.query("COMMIT");
    assert.equal((await client.query("SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1", [vehicle])).rows[0].kilometraje_actual, 950);
    const history = (await client.query("SELECT kilometraje FROM historial_kilometraje_vehiculos WHERE id_vehiculos=$1 ORDER BY id_historial_kilometraje", [vehicle])).rows;
    assert.deepEqual(history.map(r => r.kilometraje), [1000,900,950]);
  } finally { client.release(); }
  let delivered = 0;
  await processOdometerAlerts({ sendPhoto: async () => { throw new Error("offline Telegram"); } });
  assert.equal((await databasePool.query("SELECT telegram_enviado_en FROM ajustes_odometro_viaje WHERE id_viajes=$1", [trip.id_viajes])).rows[0].telegram_enviado_en, null);
  await databasePool.query("UPDATE ajustes_odometro_viaje SET siguiente_intento=CURRENT_TIMESTAMP WHERE id_viajes=$1", [trip.id_viajes]);
  assert.equal(await processOdometerAlerts({ sendPhoto: async (photo, caption) => { assert.ok(Buffer.isBuffer(photo) || photo instanceof Uint8Array); assert.match(caption, /Lectura corregida: 900/); delivered++; } }), 1);
  await processOdometerAlerts({ sendPhoto: async () => delivered++ });
  assert.equal(delivered, 1);
  assert.match(odometerCaption({ folio: "VJ", lectura_anterior: 1000, lectura_nueva: 900, motivo: "Error" }), /diferencia no cuenta/);
});
