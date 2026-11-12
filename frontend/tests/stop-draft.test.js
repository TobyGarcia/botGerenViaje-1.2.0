import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStopDraft } from '../src/utils/stop-draft.js';
const vehicles=[{id_vehiculos:2,nombre:'R-1'},{id_vehiculos:3,nombre:'R-2'}];
const inspection={idRemolque:2,captureId:crypto.randomUUID(),checklist:{luces:'B'},danos:{frontal:[{x:40,y:50}]}};

test('combina las dos pestañas en una única selección sin perder bajas ni inspección',()=>{
  const stagedActions=[{type:'COMPANION_DROPPED_OFF',itemRef:'companion-0',name:'Inicial'},{type:'TRAILER_DETACHED',itemRef:'initial-trailer',name:'R-ANTERIOR'}];
  const result=buildStopDraft({stagedActions,companionDraft:[' Ana ','Luis',' '],trailerId:'2',inspection,warningConfirmed:true,vehicles});
  assert.equal(result.error,'');assert.equal(result.actions.length,5);
  assert.deepEqual(result.actions.map(action=>action.type),['COMPANION_DROPPED_OFF','TRAILER_DETACHED','COMPANION_ADDED','COMPANION_ADDED','TRAILER_ATTACHED']);
  assert.equal(result.actions[2].name,'Ana');assert.equal(result.actions[4].inspection,inspection);
  assert.equal(stagedActions.length,2);
});

test('un remolque sin inspección nueva y confirmada impide confirmar también desde Acompañantes',()=>{
  for(const changes of [{inspection:null},{warningConfirmed:false},{inspection:{...inspection,idRemolque:3}},{inspection:{...inspection,captureId:null}}]){
    const result=buildStopDraft({companionDraft:['Ana'],trailerId:2,inspection,warningConfirmed:true,vehicles,...changes});
    assert.match(result.error,/inspección nueva/);
    assert.equal(result.actions.filter(action=>action.type==='TRAILER_ATTACHED').length,0);
  }
});

test('permite varios enganches con capturas distintas y rechaza repetir el remolque de la selección',()=>{
  const stagedActions=buildStopDraft({trailerId:2,inspection,warningConfirmed:true,vehicles}).actions;
  const second=buildStopDraft({stagedActions,trailerId:3,inspection:{...inspection,idRemolque:3,captureId:crypto.randomUUID()},warningConfirmed:true,vehicles});
  assert.equal(second.error,'');assert.equal(second.actions.length,2);
  assert.notEqual(second.actions[0].inspection.captureId,second.actions[1].inspection.captureId);
  assert.match(buildStopDraft({stagedActions,trailerId:2,inspection,warningConfirmed:true,vehicles}).error,/ya está seleccionado/);
});
