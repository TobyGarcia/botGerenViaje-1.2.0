import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });

const { isDuplicateGpsReading } = await import("../src/services/tracking-service.js");

test("identifica únicamente la misma lectura GPS en caché", () => {
  const previous = { fechaGps: "2026-10-08T15:00:00.000Z", latitud: 19.4, longitud: -99.1 };
  assert.equal(isDuplicateGpsReading(previous, { ...previous }), true);
  assert.equal(isDuplicateGpsReading(previous, { ...previous, fechaGps: "2026-10-08T15:00:10.000Z" }), false);
  assert.equal(isDuplicateGpsReading(previous, { ...previous, latitud: 19.4001 }), false);
});
