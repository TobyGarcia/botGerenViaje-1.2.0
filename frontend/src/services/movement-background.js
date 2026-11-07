import { Capacitor } from '@capacitor/core';
import safeStorage from '../utils/safeStorage.js';
import { getOfflineTrip, resolveOfflineTripId, uuid } from './offline-trip-storage.js';

let status='';
const publishers=new Map();
export const movementBackgroundStatus=()=>status;
function open() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('gv-background-movements-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('jobs',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function publishBackgroundMovements(driverId) {
  const prior=publishers.get(driverId) || Promise.resolve();
  const run=()=>globalThis.navigator?.locks ? navigator.locks.request(`gv-background-publish-${driverId}`,()=>publishCurrent(driverId)) : publishCurrent(driverId);
  const job=prior.catch(()=>{}).then(run);publishers.set(driverId,job);
  try{return await job;}finally{if(publishers.get(driverId)===job)publishers.delete(driverId);}
}
async function publishCurrent(driverId) {
  if(Number(safeStorage.getJSON('cached_driver',{})?.id_conductores)!==Number(driverId))return;
  const native=Capacitor.isNativePlatform();
  if(!native && typeof indexedDB==='undefined')return;
  const {getApiBaseUrl}=await import('./api.js');
  const origin=new URL(getApiBaseUrl() || window.location.origin,window.location.href).origin;
  const token=safeStorage.getItem('driver_token') || '';
  const state=JSON.parse(window.localStorage.getItem(`gv_trip_movements_v1:${driverId}`) || '{}');
  const jobs=[];
  for(const [tripId,current] of Object.entries(state)) {
    const local=Number(tripId)<0?getOfflineTrip(driverId,Number(tripId)):null;
    const completion=current.completionResult?null:current.completion;
    if(!current.pending.length && !completion && !(local?.startedAt && local.finishedAt && !local.synced))continue;
    const bootstrap=local?.startedAt?{clientId:local.clientId,permit:local.permit,trip:local.trip,startedAt:local.startedAt,
      initialLocation:local.initialLocation,finishedAt:local.cancelledAt?undefined:local.finishedAt,cancelledAt:local.cancelledAt,kilometrajeFinal:local.kilometrajeFinal}:null;
    jobs.push({id:`${driverId}:${tripId}`,driverId:Number(driverId),tripId:String(tripId),serverId:resolveOfflineTripId(Number(tripId)) || 0,
      origin,token,revision:uuid(),operations:current.pending,completion,bootstrap});
  }
  if(native) {
    const {NativeGps}=await import('./native-gps.js');
    const capabilities=await NativeGps.status({});
    if(!capabilities.movementSyncSupported){status='Actualiza la APK para sincronizar movimientos con la aplicación cerrada.';return;}
    await NativeGps.movements({driver:Number(driverId),origin,token,jobs:jobs.map(({token,...job})=>job)});
    status='La APK tiene programada la sincronización en segundo plano.';
    return;
  }
  const db=await open();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs'),request=store.getAll();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    request.onsuccess=()=>{
      const ids=new Set(jobs.map(job=>job.id));
      for(const existing of request.result)if(existing.driverId===Number(driverId) && !ids.has(existing.id))store.delete(existing.id);
      for(const job of jobs)store.put(job);
    };
  });}finally{db.close();}
  if(!jobs.length)return;
  if(!navigator.serviceWorker){status='Este navegador requiere abrir la aplicación para sincronizar.';return;}
  let timer;
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]).finally(()=>clearTimeout(timer));
  if(!registration){status='Abre la aplicación para activar la sincronización en segundo plano.';return;}
  if(registration.sync){await registration.sync.register('gv-trip-movements');status='El navegador tiene programada la sincronización en segundo plano.';}
  else status='Este navegador requiere abrir la aplicación para sincronizar.';
  if(navigator.onLine)registration.active?.postMessage({type:'GV_SYNC_MOVEMENTS'});
}

export function installMovementBackgroundSync() {
  const publish=()=>{
    const driver=safeStorage.getJSON('cached_driver',{});
    if(driver.id_conductores)void publishBackgroundMovements(driver.id_conductores).catch(()=>{status='Los datos se conservan; vuelve a abrir para reintentar la sincronización.';});
  };
  window.addEventListener('online',publish);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')publish();});
  publish();
}
