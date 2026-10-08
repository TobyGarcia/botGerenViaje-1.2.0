import { registrarUbicacionesLote } from "./api.js";
import { getCurrentLocation } from "./location-provider.js";
import { countPendingLocations, getPendingLocations, quarantinePendingLocations, removePendingLocations, savePendingLocation } from "./tracking-storage.js";
import { clearTrackingState, getTrackingState, saveTrackingState } from "./tracking-state.js";
import { resolveOfflineTripId, uuid } from "./offline-trip-storage.js";
export { countPendingLocations as countPendingForTrip } from "./tracking-storage.js";
import { startSilentAudioKeepAlive, stopSilentAudioKeepAlive } from "./background-audio.js";

const intervalValue = Number(import.meta.env?.VITE_GPS_TRACKING_INTERVAL_MS);
const batchValue = Number(import.meta.env?.VITE_GPS_SYNC_BATCH_SIZE);
const TRACKING_INTERVAL_MS = Number.isFinite(intervalValue) && intervalValue >= 1000 ? intervalValue : 30000;
const SYNC_BATCH_SIZE = Number.isFinite(batchValue) && batchValue > 0 ? Math.min(batchValue, 200) : 100;
let intervalId = null;
let activeTripId = null;
const syncPromises = new Map();
let statusListener = null;
let isStarting = false;
let capturePromise = null;
let trackingGeneration = 0;
const LAST_LOCATION_PREFIX = "gv_last_gps_v2:";
const DIAGNOSTIC_PREFIX = "gv_gps_diagnostic_v1:";

function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
export function isDuplicateGpsReading(previous, current) {
  return previous && previous.fechaGps === current.fechaGps &&
    Number(previous.latitud) === Number(current.latitud) && Number(previous.longitud) === Number(current.longitud);
}
function recordDiagnostic(idViaje, update) {
  const key = DIAGNOSTIC_PREFIX + Number(idViaje);
  writeJson(key, { ...(readJson(key) || {}), ...update, actualizadoEn: new Date().toISOString() });
}

function notify(update) {
  statusListener?.({ idViaje: activeTripId, active: intervalId !== null, connection: navigator.onLine ? "En línea" : "Sin conexión", ...update });
}
async function notifyPending(idViaje, update = {}) { notify({ pending: await countPendingLocations(idViaje), ...update }); }
export function setTrackingStatusListener(listener) { statusListener = listener; }
export function isTrackingActive() { return intervalId !== null; }

export async function syncPendingLocations(idViaje) {
  if (syncPromises.has(idViaje)) return syncPromises.get(idViaje);
  const syncPromise = (async () => {
    const pending = await getPendingLocations(idViaje);
    if (!pending.length) { await notifyPending(idViaje, { status: "Sincronizado" }); return { completed: true, pending: 0 }; }
    if (!navigator.onLine) { await notifyPending(idViaje, { status: "Sin conexión, guardando localmente" }); return { completed: false, pending: pending.length }; }
    const serverId = resolveOfflineTripId(idViaje);
    if (!serverId) { await notifyPending(idViaje, { status: "GPS guardado; inicio de viaje pendiente de sincronizar" }); return { completed: false, pending: pending.length }; }
    notify({ status: "Sincronizando" });
    for (let index = 0; index < pending.length; index += SYNC_BATCH_SIZE) {
      const batch = pending.slice(index, index + SYNC_BATCH_SIZE);
      const response = await registrarUbicacionesLote(serverId, batch.map(p => ({ ...p, idViaje: serverId })));
      const rejectedIds = new Set(response.data.idsRechazados || []);
      if (response.data.rechazadas > 0 && rejectedIds.size === 0) {
        await notifyPending(idViaje, { status: "Algunas ubicaciones requieren reintento" });
        return { completed: false, pending: await countPendingLocations(idViaje) };
      }
      const rejected = batch.filter(location => rejectedIds.has(location.clientLocationId));
      const accepted = batch.filter(location => !rejectedIds.has(location.clientLocationId));
      if (rejected.length) await quarantinePendingLocations(rejected);
      await removePendingLocations(accepted.map((location) => location.clientLocationId));
    }
    await notifyPending(idViaje, { status: "Sincronizado" });
    return { completed: true, pending: 0 };
  })();
  syncPromises.set(idViaje, syncPromise);
  try { return await syncPromise; }
  catch (error) { await notifyPending(idViaje, { status: "Sin conexión, guardando localmente" }); return { completed: false, pending: await countPendingLocations(idViaje), error }; }
  finally { syncPromises.delete(idViaje); }
}

export async function captureAndQueueLocation(idViaje, extraData = {}) {
  try {
    const pendingLocation = await captureAndStoreLocation(idViaje, extraData);
    await syncPendingLocations(idViaje);
    return pendingLocation;
  } catch (error) { notify({ status: "Sin señal GPS", error: error.message }); return null; }
}

async function captureAndStoreLocation(idViaje, extraData = {}) {
  if (capturePromise) {
    const current = await capturePromise;
    if (extraData.esPuntoIntermedio || extraData.esUbicacionInicial || extraData.esUbicacionFinal) {
      return captureAndStoreLocation(idViaje, extraData);
    }
    return current;
  }
  capturePromise = (async () => {
    const attemptAt = new Date().toISOString();
    recordDiagnostic(idViaje, { ultimoIntentoEn: attemptAt });
    const location = await getCurrentLocation();
    const isBackground = typeof document !== "undefined" ? Boolean(document.hidden) : false;
    const previous = readJson(LAST_LOCATION_PREFIX + Number(idViaje));
    if (isDuplicateGpsReading(previous, location) && !extraData.esPuntoIntermedio && !extraData.esUbicacionInicial && !extraData.esUbicacionFinal) {
      recordDiagnostic(idViaje, { ultimaLecturaDuplicadaEn: attemptAt });
      return { ...previous, duplicate: true };
    }
    const savedAt = new Date().toISOString();
    const gapMs = previous ? Math.max(0, +new Date(location.fechaGps) - +new Date(previous.fechaGps)) : 0;
    const pendingLocation = { ...location, isBackground, fechaGuardadoLocal: savedAt, ...extraData,
      clientLocationId: uuid(), idViaje: Number(idViaje) };
    await savePendingLocation(pendingLocation);
    writeJson(LAST_LOCATION_PREFIX + Number(idViaje), pendingLocation);
    recordDiagnostic(idViaje, { ultimaCapturaEn: location.fechaGps, ultimoGuardadoLocalEn: savedAt,
      ultimoHuecoMs: gapMs > 90000 ? gapMs : 0, ultimoError: null, origenCaptura: location.origenCaptura });
  await notifyPending(idViaje, {
    status: extraData.esPuntoIntermedio ? "Punto intermedio capturado" : "Ubicación capturada",
    lastCapture: pendingLocation.fechaGps,
    latitude: pendingLocation.latitud,
    longitude: pendingLocation.longitud,
    isBackground
  });
  return pendingLocation;
  })();
  try { return await capturePromise; }
  catch (error) { recordDiagnostic(idViaje, { ultimoError: error.message, ultimoErrorEn: new Date().toISOString() }); throw error; }
  finally { capturePromise = null; }
}

export async function captureInitialTripLocation(idViaje) {
  try {
    return await captureAndStoreLocation(idViaje, { esUbicacionInicial: true });
  } catch (error) {
    notify({ status: "Se requiere GPS para iniciar", error: error.message });
    throw new Error(`No se pudo obtener y guardar la ubicación GPS inicial: ${error.message}`);
  }
}

export async function captureIntermediatePoint(idViaje, nombrePunto = "Punto Intermedio", categoria = "") {
  const finalName = categoria ? `[${categoria}] ${nombrePunto}` : (nombrePunto || "Punto Intermedio");
  return captureAndQueueLocation(idViaje, {
    esPuntoIntermedio: true,
    nombrePunto: finalName,
    categoriaParada: categoria || null
  });
}

export async function startTracking(idViaje, { captureImmediately = true } = {}) {
  const normalizedId = Number(idViaje);
  if (isStarting) return;
  if (intervalId !== null && activeTripId === normalizedId) {
    if (captureImmediately) await captureAndQueueLocation(normalizedId);
    return;
  }

  isStarting = true;
  try {
    stopTracking({ clearState: false });
    const generation = ++trackingGeneration;
    activeTripId = normalizedId;
    saveTrackingState({ idViaje: normalizedId, trackingActivo: true, intervaloMs: TRACKING_INTERVAL_MS, iniciadoEn: new Date().toISOString() });
    
    // Iniciar bucle de audio silencioso estrictamente en móvil para evitar que el SO duerma el GPS
    void startSilentAudioKeepAlive().catch(() => {});

    notify({ status: "Esperando permiso" });
    if (captureImmediately) await captureAndQueueLocation(normalizedId);
    intervalId = window.setInterval(() => {
      if (generation === trackingGeneration) void captureAndQueueLocation(normalizedId);
    }, TRACKING_INTERVAL_MS);
    await notifyPending(normalizedId, { status: "Activo" });
  } finally {
    isStarting = false;
  }
}

export function stopTracking({ clearState = true } = {}) {
  trackingGeneration += 1;
  if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
  if (clearState) clearTrackingState();
  activeTripId = null;
  // Detener y liberar audio silencioso y estado de multimedia en móvil
  stopSilentAudioKeepAlive();
  notify({ status: "Detenido" });
}
export async function resumeTrackingIfNeeded() {
  const state = getTrackingState();
  if (state?.trackingActivo && state.idViaje) { await startTracking(state.idViaje); return state.idViaje; }
  return null;
}
