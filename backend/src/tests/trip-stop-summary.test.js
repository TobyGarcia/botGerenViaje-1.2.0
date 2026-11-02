import test from 'node:test';
import assert from 'node:assert/strict';
import {formatStopSummary} from '../services/trip-operation-message.js';
const event=(id,type,name,seconds=0,latitude=19.4)=>({id,trip_id:1,event_type:type,created_at:new Date(1793640000000+seconds*1000),payload:{folio:'TEST',name,latitude,longitude:-99.1}});
test('agrupa movimientos separados de una parada sin repetir folio ni GPS',()=>{
 const events=[event(1,'COMPANION_DROPPED_OFF','Ana'),event(2,'COMPANION_ADDED','Luis',4),event(3,'COMPANION_ADDED','María',8)];
 const text=formatStopSummary(events);
 assert.match(text,/Subieron\n• Luis\n• María/); assert.match(text,/Bajaron\n• Ana/);
 assert.equal(text.split('TEST').length-1,1); assert.doesNotMatch(text,/19\.4|-99\.1|maps/);
});
test('el mensaje contiene todas las acciones confirmadas de acompañantes y remolques',()=>{
 const confirmation=event(1,'COMPANION_DROPPED_OFF','');
 confirmation.payload.actions=[{type:'COMPANION_DROPPED_OFF',name:'Ana'},{type:'COMPANION_DROPPED_OFF',name:'Luis'},{type:'TRAILER_DETACHED',name:'R-1'}];
 const text=formatStopSummary([confirmation]);
 assert.match(text,/Bajaron\n• Ana\n• Luis/);assert.match(text,/Remolques dejados\n• R-1/);
});
