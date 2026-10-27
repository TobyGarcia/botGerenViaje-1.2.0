import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { databasePool } from "../database/pool.js";
import { completeNativeTrip, validateNativeCompletion } from "../services/native-completion.service.js";

test("valida el cierre offline y conserva la hora original", () => {
  const request = { clientId: randomUUID(), action: "finalizado", recordedAt: new Date().toISOString(), kilometrajeFinal: 150 };
  assert.equal(validateNativeCompletion(request).recordedAt, request.recordedAt);
  assert.throws(() => validateNativeCompletion({ ...request, kilometrajeFinal: -1 }));
  assert.throws(() => validateNativeCompletion({ ...request, recordedAt: "2099-01-01" }));
});

test("cierre repetido no vuelve a operar y un cierre ajeno queda rechazado", async () => {
  const driver = (await databasePool.query("INSERT INTO conductores(nombre) VALUES('Nativo Prueba') RETURNING id_conductores")).rows[0].id_conductores;
  const vehicle = (await databasePool.query("INSERT INTO vehiculos(nombre,numero_economico) VALUES('Nativo Unidad',$1) RETURNING id_vehiculos", [randomUUID()])).rows[0].id_vehiculos;
  const origin = (await databasePool.query("INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares", [randomUUID()])).rows[0].id_lugares;
  const destination = (await databasePool.query("INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares", [randomUUID()])).rows[0].id_lugares;
  const trip = (await databasePool.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,hora_salida,licencia_vigente,motivo)
    VALUES($1,$2,$3,$4,$5,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='EN_CURSO'),100,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')-INTERVAL '10 minutes',TRUE,'Prueba nativa') RETURNING id_viajes`, [randomUUID().slice(0,28),driver,vehicle,origin,destination])).rows[0].id_viajes;
  const request = { clientId: randomUUID(), action: "finalizado", recordedAt: new Date().toISOString(), kilometrajeFinal: 150 };
  await assert.rejects(completeNativeTrip(trip, driver+1000, request), /no pertenece/);
  const first = await completeNativeTrip(trip, driver, request);
  assert.equal(first.notify, true);
  const repeated = await completeNativeTrip(trip, driver, request);
  assert.equal(repeated.notify, false);
  assert.equal(repeated.trip.estado, "FINALIZADO");
  await assert.rejects(completeNativeTrip(trip, driver, { ...request, kilometrajeFinal: 151 }), /otros datos/);
  assert.equal((await databasePool.query("SELECT COUNT(*)::int AS total FROM cierres_nativos WHERE id_viajes=$1", [trip])).rows[0].total, 1);
});
