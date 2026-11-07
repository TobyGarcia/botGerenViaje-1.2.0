import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStartTripVehicle } from '../src/utils/start-trip-vehicle.js';

const vehicle = { id_vehiculos: 10, nombre: 'HONDA BRV', kilometraje_actual: 633 };
const trailer = { id_vehiculos: 20, nombre: 'Remolque', kilometraje_actual: 0 };
const catalog = [trailer, vehicle];

test('resuelve el detalle de la API después de inspeccionar, con y sin remolque', () => {
  for (const llevaRemolque of [false, true]) {
    const details = { vehiculo: { idVehiculo: 10 }, llevaRemolque, idRemolque: 20 };
    assert.equal(resolveStartTripVehicle(details, catalog), vehicle);
  }
});

test('conserva los viajes offline y no sustituye la unidad por un remolque o por otra del catálogo', () => {
  assert.equal(resolveStartTripVehicle({ idVehiculo: '10' }, catalog), vehicle);
  assert.equal(resolveStartTripVehicle({ id_vehiculos: 10 }, catalog), vehicle);
  assert.equal(resolveStartTripVehicle({ vehiculo: { idVehiculo: 99 } }, catalog), null);
  assert.equal(resolveStartTripVehicle({}, catalog), null);
});
