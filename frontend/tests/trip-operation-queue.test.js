import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStopDraft } from '../src/utils/stop-draft.js';
const values=new Map(); let failWrite=false;
globalThis.window={location:{pathname:'/'},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(failWrite)throw new Error('quota');values.set(key,String(value));},removeItem:key=>values.delete(key)}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
const queue=await import('../src/services/trip-operation-queue.js');
const {cacheMovementState,getMovementState,projectMovements,enqueueMovement,pendingMovementCount,syncTripMovements,queueMovementCompletion}=queue;
const places=[{id_lugares:1,nombre:'Patio original'}],vehicles=[{id_vehiculos:2,nombre:'R-1',tipo_vehiculo:'Remolque'}];
const operation=actions=>({type:'CONFIRMED_ACTIONS',eventKey:crypto.randomUUID(),recordedAt:new Date().toISOString(),latitude:19.4,longitude:-99.1,placeId:1,actions});
const hook=(captureId=crypto.randomUUID())=>({type:'TRAILER_ATTACHED',itemId:2,inspectionMode:'new',warningConfirmed:true,inspection:{idRemolque:2,captureId,checklist:{luces:'B'},danos:{frente:[{x:1,y:2}]}}});
test.beforeEach(()=>{values.clear();failWrite=false;navigator.onLine=false;});
async function prepare(items=[]) { await cacheMovementState(7,1,{items,places,vehicles}); }

test('personal y remolque de ambas pestañas se guardan y sincronizan como una única parada',async()=>{
 await prepare();
 const inspection=hook().inspection;
 const draft=buildStopDraft({companionDraft:['Ana','Luis'],trailerId:2,inspection,warningConfirmed:true,vehicles});
 assert.equal(draft.error,'');
 const body=operation(draft.actions);await enqueueMovement(7,1,body);
 assert.equal(pendingMovementCount(7,1),1);
 assert.equal(getMovementState(7,1).pending[0].actions.length,3);
 const projected=projectMovements(getMovementState(7,1));
 assert.equal(projected.filter(item=>item.kind==='companion').length,2);
 assert.equal(projected.find(item=>item.kind==='trailer').inspection.data.captureId,inspection.captureId);
 navigator.onLine=true;const sent=[];
 await syncTripMovements(7,1,{send:async(id,payload)=>sent.push(payload),fetchItems:async()=>({data:projected})});
 await syncTripMovements(7,1,{send:async(id,payload)=>sent.push(payload),fetchItems:async()=>({data:projected})});
 assert.equal(sent.length,1);assert.equal(sent[0].eventKey,body.eventKey);
 assert.equal(sent[0].actions.length,3);assert.equal(pendingMovementCount(7,1),0);
});

test('guarda lugar, hora, GPS e inspección; al recargar permite dejar altas locales y exige inspección nueva',async()=>{
 await prepare([{id:1,initial_key:'companion-0',kind:'companion',name:'Inicial',removed_at:null}]);
 const attach=hook();
 const first=operation([{type:'COMPANION_DROPPED_OFF',itemRef:'companion-0'},{type:'COMPANION_ADDED',name:'Luis'},attach]);
 await enqueueMovement(7,1,first);
 const reloaded=await import('../src/services/trip-operation-queue.js?reload');
 const saved=reloaded.getMovementState(7,1);
 assert.equal(saved.pending[0].placeName,'Patio original');
 assert.equal(saved.pending[0].recordedAt,first.recordedAt);
 assert.equal(saved.pending[0].latitude,19.4);
 assert.deepEqual(saved.pending[0].actions[2].inspection,attach.inspection);
 await enqueueMovement(7,1,operation([{type:'COMPANION_DROPPED_OFF',itemRef:`movement-${first.eventKey}_1`},{type:'TRAILER_DETACHED',itemRef:`movement-${first.eventKey}_2`}]));
 assert.equal(projectMovements(getMovementState(7,1)).filter(item=>!item.removed_at).length,0);
 await assert.rejects(enqueueMovement(7,1,operation([attach])),/inspección ya se utilizó/);
 await enqueueMovement(7,1,operation([hook()]));
 assert.equal(projectMovements(getMovementState(7,1)).filter(item=>!item.removed_at).length,1);
 assert.equal(pendingMovementCount(7,1),3);
 assert.equal(getMovementState(8,1),null);
});

test('el rechazo local o almacenamiento lleno no confirma acciones ni pierde la cola anterior',async()=>{
 await prepare();
 await enqueueMovement(7,1,operation(['A','B','C','D'].map(name=>({type:'COMPANION_ADDED',name}))));
 await assert.rejects(enqueueMovement(7,1,operation([{type:'COMPANION_ADDED',name:'Exceso'}])),/máximo 4/);
 failWrite=true;
 await assert.rejects(enqueueMovement(7,1,operation([{type:'COMPANION_DROPPED_OFF',itemRef:projectMovements(getMovementState(7,1))[0].initial_key}])));
 failWrite=false;
 assert.equal(pendingMovementCount(7,1),1);
 assert.equal(projectMovements(getMovementState(7,1)).filter(item=>!item.removed_at).length,4);
});

test('una respuesta perdida reenvía la misma clave y sincroniza antes del cierre sin duplicar',async()=>{
 await prepare(); navigator.onLine=true;
 const body=operation([{type:'COMPANION_ADDED',name:'Ana'}]);await enqueueMovement(7,1,body);
 await queueMovementCompletion(7,1,{action:'finalizado',kilometrajeFinal:200});
 let loseMovement=true,loseClose=true;const events=new Set(),closes=new Set(),order=[];
 const options={send:async(id,payload)=>{events.add(payload.eventKey);order.push('movement');if(loseMovement){loseMovement=false;throw new Error('Respuesta perdida');}},
  fetchItems:async()=>({data:[{id:3,initial_key:`movement-${body.eventKey}_0`,kind:'companion',name:'Ana',removed_at:null}]}),
  beforeCompletion:async()=>{order.push('gps');},complete:async(id,payload)=>{order.push('close');closes.add(payload.clientId);if(loseClose){loseClose=false;throw new Error('Cierre sin respuesta');}return {data:{idViaje:1,estado:'FINALIZADO'}};}};
 await assert.rejects(syncTripMovements(7,1,options));
 assert.equal(pendingMovementCount(7,1),1);
 await assert.rejects(syncTripMovements(7,1,options));
 assert.equal(pendingMovementCount(7,1),0);
 await syncTripMovements(7,1,options);await syncTripMovements(7,1,options);
 assert.equal(events.size,1);assert.equal(closes.size,1);
 assert.deepEqual(order,['movement','movement','gps','close','gps','close']);
 assert.equal(projectMovements(getMovementState(7,1)).filter(item=>!item.removed_at).length,1);
 await assert.rejects(enqueueMovement(7,1,operation([{type:'COMPANION_ADDED',name:'Tarde'}])),/cerrado/);
});

test('conserva los movimientos nuevos que se confirman mientras hay una sincronización en curso',async()=>{
 await prepare();navigator.onLine=true;
 const first=operation([{type:'COMPANION_ADDED',name:'Ana'}]);
 await enqueueMovement(7,1,first);let serverItems=[];const keys=[];
 await syncTripMovements(7,1,{send:async(id,body)=>{
   keys.push(body.eventKey);
   serverItems=projectMovements({...getMovementState(7,1),items:serverItems,pending:[body]});
   if(keys.length===1)await enqueueMovement(7,1,operation([{type:'COMPANION_DROPPED_OFF',itemRef:`movement-${first.eventKey}_0`}]));
 },fetchItems:async()=>({data:serverItems})});
 assert.equal(new Set(keys).size,2);assert.equal(pendingMovementCount(7,1),0);
 assert.equal(projectMovements(getMovementState(7,1)).filter(item=>!item.removed_at).length,0);
});

test('un conflicto de servidor conserva movimientos e impide adelantar el cierre',async()=>{
 await prepare();navigator.onLine=true;
 await enqueueMovement(7,1,operation([hook()]));await queueMovementCompletion(7,1,{action:'cancelado'});
 let closed=false;
 await assert.rejects(syncTripMovements(7,1,{send:async()=>{throw Object.assign(new Error('Conflicto de inspección'),{status:409});},complete:async()=>{closed=true;}}),/Conflicto/);
 assert.equal(pendingMovementCount(7,1),1);assert.equal(closed,false);
});

test('al recuperar el viaje, un cierre guardado no vuelve a mostrarse en curso',async()=>{
 await prepare();
 values.set('cached_driver',JSON.stringify({id_conductores:7}));
 await queueMovementCompletion(7,1,{action:'finalizado',kilometrajeFinal:200});
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{idViaje:1,estado:'EN_CURSO'}}),{status:200});
 try {
   const {getViajeActivo}=await import('../src/services/api.js');
   const response=await getViajeActivo();
   assert.equal(response.data.estado,'FINALIZADO');assert.equal(response.data.cierrePendiente,true);
   assert.equal(response.data.kilometrajeFinal,200);
 } finally {globalThis.fetch=originalFetch;}
});
