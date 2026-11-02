import test from 'node:test';
import assert from 'node:assert/strict';
import {groupStopEvents,formatStopSummary} from '../services/trip-operation-message.js';
const event=(id,type,name,seconds=0,latitude=19.4)=>({id,trip_id:1,event_type:type,created_at:new Date(1793640000000+seconds*1000),payload:{folio:'TEST',name,latitude,longitude:-99.1}});
test('agrupa movimientos separados de una parada sin repetir folio ni GPS',()=>{
 const events=[event(1,'COMPANION_DROPPED_OFF','Ana'),event(2,'COMPANION_ADDED','Luis',4),event(3,'COMPANION_ADDED','María',8)];
 assert.equal(groupStopEvents(events).length,3);
 const text=formatStopSummary(events);
 assert.match(text,/Subieron\n• Luis\n• María/); assert.match(text,/Bajaron\n• Ana/);
 assert.equal(text.split('TEST').length-1,1); assert.doesNotMatch(text,/19\.4|-99\.1|maps/);
});
test('no mezcla otras ubicaciones, viajes, cierres ni paradas posteriores',()=>{
 const first=event(1,'COMPANION_ADDED','Ana');
 for(const other of [event(2,'COMPANION_ADDED','Luis',4,19.5),event(2,'COMPANION_ADDED','Luis',130),{...event(2,'COMPANION_ADDED','Luis',4),trip_id:2},{...event(2,'COMPANION_ADDED','Luis',4),payload:{closure:true}}]) assert.equal(groupStopEvents([first,other]).length,1);
});
