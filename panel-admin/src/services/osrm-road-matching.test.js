import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSnappedRoadGeometry, filterJitterAndCleanPoints } from "./osrm-road-matching.js";

test("conserva paradas desviadas, GPS intermedios y orden cronológico", () => {
  const input = [
    { latitud: 19.84, longitud: -90.53, fechaGps: "2026-10-26T10:02:00Z" },
    { latitud: 19.83, longitud: -90.52, fechaGps: "2026-10-26T10:00:00Z" },
    { latitud: 19.90, longitud: -90.60, es_punto_intermedio: true, fechaGps: "2026-10-26T10:01:00Z" }
  ];
  const result = filterJitterAndCleanPoints(input);
  assert.equal(result.length, 3);
  assert.equal(result[1].es_punto_intermedio, true);
});

test("envía todos los puntos por bloques solapados y cancela antes de consultar", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const points = JSON.parse(options.body).points;
    calls.push(points);
    return { ok: true, json: async () => ({ geometry: points }) };
  };
  try {
    const points = Array.from({ length: 12 }, (_, i) => ({ latitud: 19 + i * 0.001, longitud: -90, idUbicacion: i }));
    const result = await fetchSnappedRoadGeometry(points);
    assert.equal(result.length, 12);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].at(-1), calls[1][0]);
    await assert.rejects(fetchSnappedRoadGeometry(points, { signal: AbortSignal.abort() }), { name: "AbortError" });
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});

test("un fallo vial se propaga y nunca se convierte en una línea recta", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ message: "Sin carretera" }) });
  try {
    await assert.rejects(fetchSnappedRoadGeometry([
      { latitud: 19, longitud: -90 }, { latitud: 20, longitud: -90 }
    ]), /Sin carretera/);
  } finally { globalThis.fetch = original; }
});
