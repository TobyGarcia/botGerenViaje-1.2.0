import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInitialTripLocation, insertInitialTripLocation } from "../services/initial-trip-location.service.js";

const reference = new Date("2026-10-08T15:00:00.000Z");
const valid = {
  clientLocationId: "123e4567-e89b-42d3-a456-426614174000",
  latitud: 19.4326,
  longitud: -99.1332,
  precisionMetros: 12,
  velocidad: 0,
  direccion: 180,
  fechaGps: "2026-10-08T14:59:55.000Z"
};

test("acepta una primera ubicación reciente y completa", () => {
  const result = normalizeInitialTripLocation(valid, reference);
  assert.equal(result.latitud, 19.4326);
  assert.equal(result.fechaGps.toISOString(), valid.fechaGps);
});

test("rechaza coordenadas nulas, identificadores inválidos y ubicaciones antiguas", () => {
  assert.throws(() => normalizeInitialTripLocation({ ...valid, latitud: 0, longitud: 0 }, reference), /coordenadas válidas/);
  assert.throws(() => normalizeInitialTripLocation({ ...valid, clientLocationId: "no-uuid" }, reference), /identificador válido/);
  assert.throws(() => normalizeInitialTripLocation({ ...valid, fechaGps: "2026-10-08T14:50:00.000Z" }, reference), /inmediatamente antes/);
});

test("inserta la primera ubicación usando la transacción recibida", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 1 }; } };
  await insertInitialTripLocation(client, 44, valid, reference);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO ubicaciones_viaje/);
  assert.equal(calls[0].params[0], 44);
  assert.equal(calls[0].params[1], valid.clientLocationId);
  assert.equal(calls[0].params[8], "MINI_APP");
});
