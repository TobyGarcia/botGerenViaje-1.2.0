import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperationTripId } from '../src/utils/trip-operation-id.js';
test('resuelve el ID local a su viaje sincronizado y nunca envía el timestamp a PostgreSQL', () => {
  assert.equal(resolveOperationTripId(-1793476891849928, () => 42), 42);
  assert.equal(resolveOperationTripId(-1793476891849928, () => null), null);
  assert.equal(resolveOperationTripId(1793476891849928, () => null), null);
  assert.equal(resolveOperationTripId(42, () => null), 42);
  assert.equal(resolveOperationTripId(undefined, () => null), null);
});
