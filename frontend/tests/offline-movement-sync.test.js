import test from 'node:test';
import assert from 'node:assert/strict';
const values=new Map();
globalThis.window={location:{pathname:'/'},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const {saveOfflineTrip,getOfflineTrip,resolveOfflineTripId}=await import('../src/services/offline-trip-storage.js');
const {syncOfflineTrip}=await import('../src/services/offline-trips.js');
const {cacheMovementState,enqueueMovement,projectMovements,getMovementState,pendingMovementCount,syncTripMovements}=await import('../src/services/trip-operation-queue.js');

test('abre y mapea el viaje local, envía movimientos y GPS, y solo después finaliza',async()=>{
 values.clear();values.set('cached_driver',JSON.stringify({id_conductores:7}));
 const startedAt=new Date(Date.now()-120000).toISOString(),finishedAt=new Date().toISOString();
 const record={clientId:crypto.randomUUID(),localId:-100,permit:'test-permit',startedAt,trip:{idConductor:7,idVehiculo:3,kilometrajeInicial:100},display:{},initialLocation:{clientLocationId:crypto.randomUUID(),idViaje:-100,latitud:19.4,longitud:-99.1,fechaGps:startedAt}};
 saveOfflineTrip(record);
 await cacheMovementState(7,-100,{items:[],places:[{id_lugares:1,nombre:'Patio'}],vehicles:[]});
 const body={type:'CONFIRMED_ACTIONS',eventKey:crypto.randomUUID(),recordedAt:new Date(Date.now()-60000).toISOString(),latitude:19.4,longitude:-99.1,placeId:1,actions:[{type:'COMPANION_ADDED',name:'Ana'}]};
 await enqueueMovement(7,-100,body);
 saveOfflineTrip({...getOfflineTrip(7,-100),finishedAt,kilometrajeFinal:105});
 const order=[];let serverItems=[];
 const options={upload:async payload=>{
  order.push(payload.finishedAt?'finish':'start');
  if(payload.finishedAt) assert.equal(pendingMovementCount(7,-100),0);
  return {data:{idViaje:123,estado:payload.finishedAt?'FINALIZADO':'EN_CURSO'}};
 },syncMovements:async(driver,id)=>{
  assert.equal(resolveOfflineTripId(id),123);
  await syncTripMovements(driver,id,{send:async(serverId,operation)=>{
    assert.equal(serverId,123);assert.equal(operation.eventKey,body.eventKey);order.push('movement');
    serverItems=projectMovements(getMovementState(7,-100));
  },fetchItems:async()=>({data:serverItems})});
 },syncGps:async()=>{order.push('gps');return {completed:true};},countGps:async()=>0};
 await syncOfflineTrip(7,options);
 assert.deepEqual(order,['start','movement','gps','finish']);
 assert.equal(getOfflineTrip(7,-100).synced,true);
 await syncOfflineTrip(7,options);assert.equal(order.length,4);
});
