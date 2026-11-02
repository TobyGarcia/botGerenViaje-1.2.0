import test from 'node:test';
import assert from 'node:assert/strict';
import { tripCompanionHistory } from '../services/trip-companion-view.js';
test('conserva bajas iniciales y altas posteriores sin revivir acompañantes', () => {
 const trip = {acompanantes:['Ana'],hora_salida:'2026-11-02T10:00:00Z'};
 const items = [{name:'Ana',initial_key:'companion-0',added_at:trip.hora_salida,removed_at:'2026-11-02T11:00:00Z'},
 {name:'Luis',added_at:'2026-11-02T11:01:00Z',removed_at:null}];
 const history = tripCompanionHistory(trip,items);
 assert.deepEqual(history.filter(i=>!i.removed_at).map(i=>i.name),['Luis']);
 assert.deepEqual(history.map(i=>i.name),['Ana','Luis']);
 assert.equal(tripCompanionHistory(trip,[])[0].name,'Ana');
});
