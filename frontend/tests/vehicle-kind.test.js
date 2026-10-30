import test from "node:test";
import assert from "node:assert/strict";
import { isTrailer } from "../src/utils/vehicle-kind.js";

test("separa los remolques del catálogo de unidades motrices", () => {
  const vehicles = [
    { id: 1, tipo_vehiculo: "remolque", nombre: "HECHIZO PLANA RETRO" },
    { id: 2, tipo_vehiculo: " REMOLQUE ", nombre: "HECHIZO" },
    { id: 3, tipo_vehiculo: "camioneta", nombre: "MITSUBISHI L200" },
    { id: 4, tipo_vehiculo: "auto", nombre: "CHEVROLET TRAX" }
  ];
  assert.deepEqual(vehicles.filter(isTrailer).map(v => v.id), [1, 2]);
  assert.deepEqual(vehicles.filter(v => !isTrailer(v)).map(v => v.id), [3, 4]);
});
test("respeta el tipo explícito y reconoce remolques antiguos sin clasificación", () => {
  assert.equal(isTrailer({ tipo_vehiculo: "camioneta", nombre: "UNIDAD PARA REMOLQUE" }), false);
  assert.equal(isTrailer({ tipo_vehiculo: "N/A", nombre: "HECHIZO REMOLQUE" }), true);
  assert.equal(isTrailer({ nombre: "PLANA RETRO" }), true);
  assert.equal(isTrailer({ tipo_vehiculo: "Semirremolque" }), true);
  assert.equal(isTrailer({ nombre: "CAMIONETA" }), false);
  assert.equal(isTrailer(null), false);
});
