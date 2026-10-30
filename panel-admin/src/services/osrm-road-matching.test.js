import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchSnappedRoadGeometry,
  filterJitterAndCleanPoints,
  getMandatoryRoutePoints
} from "./osrm-road-matching.js";

test("ordena y conserva las lecturas GPS para referencia", () => {
  const input = [
    { latitud: 19.84, longitud: -90.53, fechaGps: "2026-10-26T10:02:00Z" },
    { latitud: 19.83, longitud: -90.52, fechaGps: "2026-10-26T10:00:00Z" },
    { latitud: 19.90, longitud: -90.60, es_punto_intermedio: true, fechaGps: "2026-10-26T10:01:00Z" }
  ];
  const result = filterJitterAndCleanPoints(input);
  assert.equal(result.length, 3);
  assert.equal(result[1].es_punto_intermedio, true);
});

test("OSRM solo recibe inicio, paradas y final; ignora GPS intermedios", () => {
  const input = [
    { latitud: 19.00, longitud: -90.00, fechaGps: "2026-10-26T10:00:00Z" },
    { latitud: 19.01, longitud: -90.01, fechaGps: "2026-10-26T10:01:00Z" },
    { latitud: 19.02, longitud: -90.02, es_punto_intermedio: true, nombre_punto: "Parada", fechaGps: "2026-10-26T10:02:00Z" },
    { latitud: 19.03, longitud: -90.03, fechaGps: "2026-10-26T10:03:00Z" },
    { latitud: 19.04, longitud: -90.04, fechaGps: "2026-10-26T10:04:00Z" }
  ];
  const result = getMandatoryRoutePoints(input);
  assert.deepEqual(result.map((point) => [point.latitud, point.longitud]), [
    [19.00, -90.00],
    [19.02, -90.02],
    [19.04, -90.04]
  ]);
});

test("envía solo puntos obligatorios por bloques solapados y cancela antes de consultar", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const points = JSON.parse(options.body).points;
    calls.push(points);
    return { ok: true, json: async () => ({ geometry: points }) };
  };
  try {
    const points = Array.from({ length: 12 }, (_, i) => ({
      latitud: 19 + i * 0.001,
      longitud: -90,
      idUbicacion: i,
      ...(i === 5 || i === 10 ? { es_punto_intermedio: true } : {})
    }));
    const result = await fetchSnappedRoadGeometry(points);
    assert.equal(result.length, 4);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], [[19, -90], [19.005, -90]]);
    await assert.rejects(fetchSnappedRoadGeometry(points, { signal: AbortSignal.abort() }), { name: "AbortError" });
    assert.equal(calls.length, 3);
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
