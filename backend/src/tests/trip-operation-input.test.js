import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTripOperationInput } from '../services/trip-operation-input.js';

const base = { type: 'COMPANION_ADDED', name: ' Ana ', latitude: 0, longitude: 0, eventKey: 'test_event_12345678' };
test('acepta coordenadas cero y normaliza el nombre', () => {
  assert.equal(parseTripOperationInput(base).name, 'Ana');
});
test('rechaza ubicación ausente, no numérica o fuera de rango', () => {
  for (const latitude of [undefined, null, '', '19', NaN, Infinity, 91]) {
    assert.throws(() => parseTripOperationInput({ ...base, latitude }));
  }
});
test('solo acepta eventos operativos, excluyendo inspecciones', () => {
  assert.throws(() => parseTripOperationInput({ ...base, type: 'INSPECTION_CREATED' }));
});
test('exige identificar el acompañante o remolque que se retira', () => {
  assert.throws(() => parseTripOperationInput({ ...base, type: 'TRAILER_DETACHED' }));
  assert.equal(parseTripOperationInput({ ...base, type: 'TRAILER_DETACHED', itemId: 2 }).itemId, 2);
});
