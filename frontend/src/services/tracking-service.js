import { registrarUbicacionesLote } from "./api.js";
import { getCurrentLocation } from "./location-provider.js";
import { countPendingLocations, getPendingLocations, removePendingLocations, savePendingLocation } from "./tracking-storage.js";
import { clearTrackingState, getTrackingState, saveTrackingState } from "./tracking-state.js";

const intervalValue = Number(import.meta.env.VITE_GPS_TRACKING_INTERVAL_MS);
const batchValue = Number(import.meta.env.VITE_GPS_SYNC_BATCH_SIZE);
const TRACKING_INTERVAL_MS = Number.isFinite(intervalValue) && intervalValue >= 1000 ? intervalValue : 30000;
const SYNC_BATCH_SIZE = Number.isFinite(batchValue) && batchValue > 0 ? Math.min(batchValue, 200) : 100;
let intervalId = null;
let activeTripId = null;
let syncPromise = null;
let statusListener = null;

function notify(update) {
  statusListener?.({ idViaje: activeTripId, active: intervalId !== null, connection: navigator.onLine ? "En línea" : "Sin conexión", ...update });
}
async function notifyPending(idViaje, update = {}) { notify({ pending: await countPendingLocations(idViaje), ...update }); }
export function setTrackingStatusListener(listener) { statusListener = listener; }
export function isTrackingActive() { return intervalId !== null; }

export async function syncPendingLocations(idViaje) {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const pending = await getPendingLocations(idViaje);
    if (!pending.length) { await notifyPending(idViaje, { status: "Sincronizado" }); return { completed: true, pending: 0 }; }
    if (!navigator.onLine) { await notifyPending(idViaje, { status: "Sin conexión, guardando localmente" }); return { completed: false, pending: pending.length }; }
    notify({ status: "Sincronizando" });
    for (let index = 0; index < pending.length; index += SYNC_BATCH_SIZE) {
      const batch = pending.slice(index, index + SYNC_BATCH_SIZE);
      const response = await registrarUbicacionesLote(idViaje, batch);
      if (response.data.rechazadas > 0) { await notifyPending(idViaje, { status: "Algunas ubicaciones requieren reintento" }); return { completed: false, pending: await countPendingLocations(idViaje) }; }
      await removePendingLocations(batch.map((location) => location.clientLocationId));
    }
    await notifyPending(idViaje, { status: "Sincronizado" });
    return { completed: true, pending: 0 };
  })();
  try { return await syncPromise; }
  catch (error) { await notifyPending(idViaje, { status: "Sin conexión, guardando localmente" }); return { completed: false, pending: await countPendingLocations(idViaje), error }; }
  finally { syncPromise = null; }
}

export async function captureAndQueueLocation(idViaje) {
  try {
    const location = await getCurrentLocation();
    const pendingLocation = { ...location, clientLocationId: crypto.randomUUID(), idViaje: Number(idViaje) };
    await savePendingLocation(pendingLocation);
    await notifyPending(idViaje, {
      status: "Ubicación capturada",
      lastCapture: pendingLocation.fechaGps,
      latitude: pendingLocation.latitud,
      longitude: pendingLocation.longitud
    });
    await syncPendingLocations(idViaje);
    return pendingLocation;
  } catch (error) { notify({ status: "Sin señal GPS", error: error.message }); return null; }
}

export async function startTracking(idViaje) {
  const normalizedId = Number(idViaje);
  if (intervalId !== null && activeTripId === normalizedId) return;
  stopTracking({ clearState: false });
  activeTripId = normalizedId;
  saveTrackingState({ idViaje: normalizedId, trackingActivo: true, intervaloMs: TRACKING_INTERVAL_MS, iniciadoEn: new Date().toISOString() });
  notify({ status: "Esperando permiso" });
  await captureAndQueueLocation(normalizedId);
  intervalId = window.setInterval(() => { captureAndQueueLocation(normalizedId); }, TRACKING_INTERVAL_MS);
  await notifyPending(normalizedId, { status: "Activo" });
}

export function stopTracking({ clearState = true } = {}) {
  if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
  if (clearState) clearTrackingState();
  activeTripId = null;
  notify({ status: "Detenido" });
}
export async function resumeTrackingIfNeeded() {
  const state = getTrackingState();
  if (state?.trackingActivo && state.idViaje) { await startTracking(state.idViaje); return state.idViaje; }
  return null;
}
