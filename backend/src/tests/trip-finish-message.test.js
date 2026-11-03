import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinishedTripLines } from '../services/trip-finish-message.js';

test('el cierre resume paradas y distingue el histórico de quienes llegaron al destino', () => {
  const message = formatFinishedTripLines({
    folio: 'VJ-TEST', conductor: 'Ana', vehiculo: 'L200', numeroEconomico: 'AUTO-1',
    horaSalida: '2026-11-02T23:00:00Z', horaLlegada: '2026-11-03T16:50:00Z',
    kilometrajeInicial: 0, kilometrajeFinal: 10, kilometrosRecorridos: 10,
    paradasTecnicas: Array.from({length: 100}, () => ({nombre_punto: 'Parada técnica: Subió Juan'})),
    elementosViaje: [{kind:'companion',name:'Luis'},{kind:'companion',name:'Juan'},
      {kind:'trailer',name:'R1'},{kind:'trailer',name:'R1'}],
    elementosAlFinalizar: [{kind:'companion',name:'Juan'}]
  }).join('\n');
  assert.match(message, /Paradas técnicas: 100/);
  assert.doesNotMatch(message, /Parada técnica: Subió/);
  assert.match(message, /Acompañantes del viaje: Luis, Juan/);
  assert.match(message, /Remolques utilizados: R1\n/);
  assert.match(message, /Al llegar al destino\nAcompañantes: Juan\nRemolques: Ninguno/);
  assert.match(message, /Kilometraje: 0 → 10 km/);
  assert.match(message, /02\/11\/2026/);
  assert.match(message, /03\/11\/2026/);
});

test('el resumen queda dentro del límite de Telegram con históricos y campos largos', () => {
  const items = Array.from({length: 200}, (_, i) => ({kind:i%2?'trailer':'companion',name:`${i} ${'x'.repeat(500)}`}));
  const trip = Object.fromEntries(['folio','conductor','vehiculo','numeroEconomico','origen','destino','motivo','kilometrajeInicial','kilometrajeFinal','kilometrosRecorridos'].map(key=>[key,'x'.repeat(5000)]));
  const message = formatFinishedTripLines({...trip,elementosViaje:items,elementosAlFinalizar:items}).join('\n');
  assert.ok(message.length < 4096);
  assert.match(message, /\(\+92 más\)/);
  assert.doesNotMatch(message, /undefined|Invalid Date/);
});
