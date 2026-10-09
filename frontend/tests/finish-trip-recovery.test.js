import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverFinishedTrip } from '../src/services/finish-trip-recovery.js';

test('recupera el cierre confirmado aunque la respuesta original se pierda', async () => {
  const result = await recoverFinishedTrip(12, async () => ({ data: { idViaje: 12, estado: { nombre: 'FINALIZADO' } } }));
  assert.equal(result.status, 'FINALIZADO');
});
test('identifica un viaje todavía en curso para permitir recuperar GPS', async () => {
  assert.equal((await recoverFinishedTrip(12, async () => ({ data: { idViaje: 12, estado: 'EN_CURSO' } }))).status, 'EN_CURSO');
});
test('sin conexión o con otro viaje no supone que sigue en curso', async () => {
  assert.equal((await recoverFinishedTrip(12, async () => { throw new Error('offline'); })).status, 'UNKNOWN');
  assert.equal((await recoverFinishedTrip(12, async () => ({ data: { idViaje: 13, estado: 'EN_CURSO' } }))).status, 'UNKNOWN');
});
