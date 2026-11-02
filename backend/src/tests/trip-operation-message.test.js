import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTripOperationMessage } from '../services/trip-operation-message.js';
test('una subida grupal tiene un solo mensaje con todos los nombres y sin GPS',()=>{
 const text=formatTripOperationMessage({event_type:'COMPANION_ADDED',created_at:'2026-11-02T15:00:00Z',payload:{folio:'TEST',names:['Ana','Luis'],latitude:19.4,longitude:-99.1}});
 assert.match(text,/Acompañantes agregados/); assert.match(text,/• Ana\n• Luis/);
 assert.doesNotMatch(text,/19\.4|-99\.1|maps|GPS/);
});
