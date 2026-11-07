import { getTripItems, recordTripOperation, completeQueuedTrip } from './api.js';
import { durableWrite, resolveOfflineTripId, uuid, getOfflineTrip } from './offline-trip-storage.js';
import { isTrailer } from '../utils/vehicle-kind.js';
import { publishBackgroundMovements } from './movement-background.js';

const key = driverId => `gv_trip_movements_v1:${driverId}`;
const read = driverId => {
  const value = window.localStorage.getItem(key(driverId));
  if (!value) return {};
  try { return JSON.parse(value); } catch { throw new Error('La cola de movimientos requiere revisión. No se sobrescribieron sus datos.'); }
};
const jobs = new Map();
const captures = new Map();
export async function withMovementCapture(driverId, tripId, callback) {
  const id=`${driverId}:${tripId}`;
  const prior=captures.get(id) || Promise.resolve();
  const job=prior.catch(()=>{}).then(()=>globalThis.navigator?.locks
    ? navigator.locks.request(`gv-movements-capture-${id}`,callback) : callback());
  captures.set(id,job);
  try { return await job; } finally { if(captures.get(id)===job) captures.delete(id); }
}
export async function waitForMovementCapture(driverId,tripId) {
  await captures.get(`${driverId}:${tripId}`)?.catch(()=>{});
  if(globalThis.navigator?.locks) await navigator.locks.request(`gv-movements-capture-${driverId}:${tripId}`,()=>{});
}
async function mutate(driverId, update) {
  const write = () => { const state = read(driverId); const result = update(state); durableWrite(key(driverId), state); return result; };
  const result=await (globalThis.navigator?.locks ? navigator.locks.request(`gv-movements-write-${driverId}`, write) : write());
  await publishBackgroundMovements(driverId).catch(()=>{});
  return result;
}
export const operationItemRef = item => item.initial_key || String(item.id);
export const getMovementState = (driverId, tripId) => read(driverId)[tripId] || null;
export const pendingMovementCount = (driverId, tripId) => getMovementState(driverId, tripId)?.pending.length || 0;
export const pendingMovementTotal = driverId => Object.values(read(driverId)).reduce((n,state)=>n+state.pending.length+(state.completion && !state.completionResult?1:0),0);
export async function sealTripMovements(driverId,tripId) {
  await waitForMovementCapture(driverId,tripId);
  return mutate(driverId,state=>{const current=state[tripId] ||= {items:[],pending:[],places:[],vehicles:[]};current.sealedAt ||= new Date().toISOString();});
}

export async function cacheMovementState(driverId, tripId, { items, places, vehicles } = {}) {
  return mutate(driverId, state => {
    const current = state[tripId] ||= { items: [], pending: [], places: [], vehicles: [] };
    if (items && !current.pending.length) { current.items = items; current.prepared = true; }
    if (places) current.places = places;
    if (vehicles) current.vehicles = vehicles;
    current.lastUsed = Date.now();
    const discardable=Object.entries(state).filter(([id,value])=>String(id)!==String(tripId) && !value.pending.length && (!value.completion || value.completionResult))
      .sort((a,b)=>(b[1].lastUsed || 0)-(a[1].lastUsed || 0));
    for(const [id] of discardable.slice(2)) delete state[id];
    return current;
  });
}

export function projectMovements(state) {
  if (!state?.prepared) throw new Error('Conéctate una vez para guardar los acompañantes y remolques actuales de este viaje.');
  const items = structuredClone(state.items);
  for (const operation of state.pending) {
    const removals = new Set(['COMPANION_DROPPED_OFF', 'TRAILER_DETACHED']);
    const indexed = operation.actions.map((action, index) => ({ ...action, index }));
    indexed.sort((a,b) => Number(removals.has(b.type)) - Number(removals.has(a.type)));
    for (const action of indexed) {
      if (removals.has(action.type)) {
        const item = items.find(item => operationItemRef(item) === String(action.itemRef ?? action.itemId) && !item.removed_at);
        const kind = action.type === 'COMPANION_DROPPED_OFF' ? 'companion' : 'trailer';
        if (!item || item.kind !== kind) throw new Error('El elemento ya fue retirado o no pertenece al viaje.');
        Object.assign(item, { removed_at: operation.recordedAt, removed_latitude: operation.latitude, removed_longitude: operation.longitude });
      } else {
        const companion = action.type === 'COMPANION_ADDED';
        if (!companion && action.type !== 'TRAILER_ATTACHED') throw new Error('Movimiento inválido.');
        if (companion && items.filter(item => item.kind === 'companion' && !item.removed_at).length >= 4) throw new Error('El vehículo admite máximo 4 acompañantes a bordo.');
        if (companion && (!action.name?.trim() || action.name.length > 200)) throw new Error('Nombre de acompañante inválido.');
        if (!companion) {
          if (!Number.isSafeInteger(action.itemId) || !state.vehicles.some(v => Number(v.id_vehiculos) === action.itemId && isTrailer(v))) throw new Error('Selecciona un remolque del catálogo guardado.');
          if (items.some(item => item.kind === 'trailer' && !item.removed_at && Number(item.trailer_id) === action.itemId)) throw new Error('El remolque ya está enganchado.');
          const capture = action.inspection?.captureId;
          if (action.inspectionMode !== 'new' || Number(action.inspection?.idRemolque) !== action.itemId || typeof capture !== 'string' || !/^[0-9a-f-]{36}$/i.test(capture) || !Object.keys(action.inspection?.checklist || {}).length || action.warningConfirmed !== true) throw new Error('Realiza y confirma una inspección nueva para este enganche.');
          if (items.some(item => (item.inspection?.data?.captureId || item.inspection?.captureId) === capture)) throw new Error('Esta inspección ya se utilizó. Realiza una nueva.');
        }
        const ref = `movement-${operation.eventKey}_${action.index}`;
        const vehicle = state.vehicles.find(v => Number(v.id_vehiculos) === action.itemId);
        items.push({ id: ref, initial_key: ref, kind: companion ? 'companion' : 'trailer',
          name: companion ? action.name.trim() : vehicle.nombre, trailer_id: companion ? null : action.itemId,
          inspection: companion ? null : { source: 'new', data: action.inspection }, added_at: operation.recordedAt,
          added_latitude: operation.latitude, added_longitude: operation.longitude, removed_at: null, pending_sync: true });
      }
    }
  }
  return items;
}

export async function enqueueMovement(driverId, tripId, body) {
  return mutate(driverId, state => {
    const current = state[tripId];
    if (!current?.prepared) throw new Error('No hay una copia del viaje preparada para registrar movimientos.');
    if (current.completion || current.sealedAt) throw new Error('El viaje ya fue cerrado en este teléfono.');
    if(Number(tripId)<0) {
      const local=getOfflineTrip(driverId,tripId);
      if(!local?.startedAt || local.finishedAt) throw new Error('El viaje local no está en curso.');
    }
    if (current.pending.some(operation => operation.eventKey === body.eventKey)) return current;
    if (!Array.isArray(body.actions) || !body.actions.length || body.actions.length > 20) throw new Error('Selecciona los movimientos que deseas confirmar.');
    if(typeof body.eventKey !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.eventKey)) throw new Error('Identificador de movimiento inválido.');
    if (!Number.isFinite(body.latitude) || Math.abs(body.latitude)>90 || !Number.isFinite(body.longitude) || Math.abs(body.longitude)>180 || !Number.isFinite(Date.parse(body.recordedAt))) throw new Error('Se requiere hora y ubicación GPS válidas.');
    const place = current.places.find(place => Number(place.id_lugares) === body.placeId);
    if (!place) throw new Error('Selecciona un lugar del catálogo guardado.');
    const next = { ...current, pending: [...current.pending, { ...body, placeName: place.nombre }] };
    projectMovements(next); // Validar antes de persistir, sin perder el estado anterior.
    state[tripId] = next;
    return next;
  });
}

export async function queueMovementCompletion(driverId, tripId, details) {
  return mutate(driverId, state => {
    const current = state[tripId] ||= { items: [], pending: [], places: [], vehicles: [] };
    current.completion ||= { ...details, clientId: uuid(), recordedAt: new Date().toISOString() };
    return current.completion;
  });
}

export async function syncTripMovements(driverId, tripId, { send = recordTripOperation, fetchItems = getTripItems, complete = completeQueuedTrip, beforeCompletion } = {}) {
  const jobKey = `${driverId}:${tripId}`;
  if (jobs.has(jobKey)) return jobs.get(jobKey);
  const run = async () => {
    const serverId = resolveOfflineTripId(tripId);
    if (!serverId || !navigator.onLine) return null;
    for (;;) {
      const first = getMovementState(driverId, tripId)?.pending[0];
      if (!first) break;
      await send(serverId, first);
      const response = await fetchItems(serverId);
      if(!Array.isArray(response.data)) throw new Error('No se recibió el estado confirmado del viaje. La cola se conserva.');
      await mutate(driverId, state => {
        const current = state[tripId];
        current.items = response.data; current.prepared = true;
        current.pending = current.pending.filter(operation => operation.eventKey !== first.eventKey);
      });
      window.dispatchEvent?.(new Event('trip-movements-synced'));
    }
    const current = getMovementState(driverId, tripId);
    if (current?.completion && !current.completionResult) {
      if (!beforeCompletion) return null;
      await beforeCompletion(tripId);
      const result = await complete(serverId, current.completion);
      await mutate(driverId, state => { state[tripId].completionResult = result.data; });
      return result.data;
    }
    return current?.completionResult || null;
  };
  const job=globalThis.navigator?.locks ? navigator.locks.request(`gv-movements-sync-${jobKey}`,run) : run();
  jobs.set(jobKey, job);
  try { return await job; } finally { jobs.delete(jobKey); }
}

export async function syncAllTripMovements(driverId, options) {
  const completed = [], errors = [];
  for (const [id, state] of Object.entries(read(driverId))) {
    if (Number(id) <= 0 || (!state.pending.length && (!state.completion || state.completionResult))) continue;
    try { const result = await syncTripMovements(driverId, Number(id), options); if (result) completed.push(result); }
    catch (error) { errors.push(error.message); }
  }
  return { completed, error: errors.join(' ') };
}
