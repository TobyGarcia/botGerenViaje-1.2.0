import test from 'node:test';
import assert from 'node:assert/strict';
import {formatStopSummary} from '../services/trip-operation-message.js';
const event=(id,type,name,seconds=0,latitude=19.4)=>({id,trip_id:1,event_type:type,created_at:new Date(1793640000000+seconds*1000),payload:{folio:'TEST',name,latitude,longitude:-99.1}});
test('agrupa las listas de personal sin repetir datos del viaje ni GPS',()=>{
 const events=[event(1,'COMPANION_DROPPED_OFF','Ana'),event(2,'COMPANION_ADDED','Luis',4),event(3,'COMPANION_ADDED','María',8)];
 const text=formatStopSummary(events);
 assert.match(text,/Se recogió personal: Luis, María/); assert.match(text,/Se dejó personal: Ana/);
 assert.ok(text.indexOf('Se dejó personal:')<text.indexOf('Se recogió personal:'));
 assert.match(text,/Hora: \d{2}:\d{2}/);
 assert.doesNotMatch(text,/TEST|Conductor:|Unidad:|Número económico:|19\.4|-99\.1|maps/);
});
test('el mensaje contiene todas las acciones confirmadas de acompañantes y remolques',()=>{
 const confirmation=event(1,'COMPANION_DROPPED_OFF','');
 confirmation.payload.actions=[{type:'COMPANION_DROPPED_OFF',name:'Ana'},{type:'COMPANION_DROPPED_OFF',name:'Luis'},{type:'TRAILER_DETACHED',name:'R-1'}];
 const text=formatStopSummary([confirmation]);
 assert.match(text,/Se dejó personal: Ana, Luis/);assert.match(text,/Se dejó remolque: R-1/);
});

test('muestra el destino de la parada con las listas en un solo mensaje sin coordenadas',()=>{
 const confirmation=event(1,'COMPANION_DROPPED_OFF','');
 confirmation.payload.place={id:1,name:'ASPX - LA PAZ'};
 confirmation.payload.actions=[{type:'COMPANION_DROPPED_OFF',name:'Ana'},{type:'COMPANION_ADDED',name:'Luis'}];
 const text=formatStopSummary([confirmation]);
 assert.match(text,/^📍 Parada técnica en ASPX - LA PAZ/);
 assert.match(text,/Se recogió personal: Luis/);
 assert.match(text,/Se dejó personal: Ana/);
 assert.doesNotMatch(text,/19\.4|-99\.1|maps/);
});

test('resume remolques con lugar, hora y listas de dejados antes de enganchados',()=>{
 const confirmation=event(1,'TRAILER_ATTACHED','R-1');
 confirmation.payload.trip={conductor:'Ana',vehiculo:'L200',numeroEconomico:'AUTO-006'};
 confirmation.payload.place={id:1,name:'ASPX - LA PAZ'};
 confirmation.payload.actions=[{type:'TRAILER_ATTACHED',name:'R-2'},{type:'TRAILER_DETACHED',name:'R-1'},{type:'TRAILER_DETACHED',name:'R-4'},{type:'TRAILER_ATTACHED',name:'R-3'}];
 const text=formatStopSummary([confirmation]);
 assert.match(text,/^📍 Parada técnica en ASPX - LA PAZ\nHora: \d{2}:\d{2}/);
 assert.match(text,/Se dejó remolque: R-1, R-4\n\nSe recogió remolque: R-2, R-3$/);
 assert.doesNotMatch(text,/•/);
 assert.doesNotMatch(text,/TEST|Conductor:|Unidad:|Número económico:|Se dejó personal:|Se recogió personal:|19\.4|-99\.1/);
});
