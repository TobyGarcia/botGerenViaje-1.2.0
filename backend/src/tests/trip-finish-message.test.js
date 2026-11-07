import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinishedTripLines, formatFinishedTripMessages } from '../services/trip-finish-message.js';

test('el cierre lista las paradas con fecha, lugar y movimientos; solo muestra quienes llegaron', () => {
  const message = formatFinishedTripLines({
    folio: 'VJ-TEST', conductor: 'Ana', vehiculo: 'L200', numeroEconomico: 'AUTO-1',
    horaSalida: '2026-11-02T23:00:00Z', horaLlegada: '2026-11-03T16:50:00Z',
    kilometrajeInicial: 0, kilometrajeFinal: 10, kilometrosRecorridos: 10,
    paradasTecnicas: [
      {nombre_punto:'Parada técnica en Patio: Se subió personal: Juan',fecha_gps:'2026-11-03T15:00:00Z'},
      {nombre_punto:'Parada técnica en Taller: Se dejó remolque: R1',fecha_gps:'2026-11-03T16:00:00Z'}
    ],
    elementosViaje: [{kind:'companion',name:'Luis'},{kind:'companion',name:'Juan'},
      {kind:'trailer',name:'R1'},{kind:'trailer',name:'R1'}],
    elementosAlFinalizar: [{kind:'companion',name:'Juan'}]
  }).join('\n');
  assert.match(message, /Paradas técnicas\n1\. .*\nParada técnica en Patio: Se subió personal: Juan\n2\. .*\nParada técnica en Taller: Se dejó remolque: R1/);
  assert.doesNotMatch(message, /Resumen del recorrido|Acompañantes del viaje|Remolques utilizados|Remolques: Ninguno|Luis/);
  assert.match(message, /Acompañantes: Juan/);
  assert.doesNotMatch(message, /Al llegar al destino/);
  assert.match(message, /Kilometraje: 0 → 10 km/);
  assert.match(message, /02\/11\/2026/);
  assert.match(message, /03\/11\/2026/);
});

test('conserva todas las paradas de recorridos largos en mensajes válidos para Telegram', () => {
  const items = Array.from({length: 200}, (_, i) => ({kind:i%2?'trailer':'companion',name:`${i} ${'x'.repeat(500)}`}));
  const trip = Object.fromEntries(['folio','conductor','vehiculo','numeroEconomico','origen','destino','motivo','kilometrajeInicial','kilometrajeFinal','kilometrosRecorridos'].map(key=>[key,'x'.repeat(5000)]));
  const stops=Array.from({length:100},(_,i)=>({nombre_punto:`Parada técnica en Lugar ${i}: Se recogió personal: Persona ${i}`,fecha_gps:'2026-11-07T15:00:00Z'}));
  const parts = formatFinishedTripMessages({...trip,paradasTecnicas:stops,elementosViaje:items,elementosAlFinalizar:items});
  const message=parts.join('\n');
  assert.ok(parts.length>1);
  assert.ok(parts.every(part=>part.length<=4000));
  for(const stop of stops)assert.ok(message.includes(stop.nombre_punto));
  assert.doesNotMatch(message, /undefined|Invalid Date/);
});

test('la llegada es dinámica para acompañantes, remolques, ambos o ninguno',()=>{
  const companion={kind:'companion',name:'Ana'},trailer={kind:'trailer',name:'R-1'};
  for(const items of [[],[companion],[trailer],[companion,trailer]]){
    const message=formatFinishedTripLines({elementosAlFinalizar:items,elementosViaje:[companion,trailer]}).join('\n');
    assert.equal(message.includes('Al llegar al destino'),false);
    assert.equal(message.includes('Acompañantes: Ana'),items.includes(companion));
    assert.equal(message.includes('Remolques: R-1'),items.includes(trailer));
    assert.doesNotMatch(message,/Ninguno|Resumen del recorrido/);
    assert.doesNotMatch(message,/Paradas técnicas|Sin paradas técnicas/);
  }
});
