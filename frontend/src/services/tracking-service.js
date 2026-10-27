import { Capacitor, registerPlugin } from "@capacitor/core";
import { registrarUbicacionesLote } from "./api.js";
import { getCurrentLocation, normalizeLocation } from "./location-provider.js";
import { diagnostics } from "./client-diagnostics.js";
import { countPendingLocations, getPendingLocations, quarantinePendingLocations, removePendingLocations, savePendingLocation } from "./tracking-storage.js";
import { clearTrackingState, saveTrackingState } from "./tracking-state.js";
import { resolveOfflineTripId, uuid } from "./offline-trip-storage.js";
export { countPendingLocations as countPendingForTrip } from "./tracking-storage.js";
import { startSilentAudioKeepAlive, stopSilentAudioKeepAlive } from "./background-audio.js";
import { NativeGps, hasNativeGps, nativeTripOptions } from "./native-gps.js";

const BackgroundGeolocationPlugin = registerPlugin("BackgroundGeolocation");

const intervalValue = Number(import.meta.env?.VITE_GPS_TRACKING_INTERVAL_MS);
const batchValue = Number(import.meta.env?.VITE_GPS_SYNC_BATCH_SIZE);
const TRACKING_INTERVAL_MS = Number.isFinite(intervalValue) && intervalValue >= 1000 ? intervalValue : 30000;
const SYNC_BATCH_SIZE = Number.isFinite(batchValue) && batchValue > 0 ? Math.min(batchValue, 200) : 100;
let intervalId = null;
let nativeWatcherId = null;
let activeTripId = null;
const syncPromises = new Map();
let statusListener = null;
let isStarting = false;
let capturePromise = null;
let trackingGeneration = 0;
const LAST_LOCATION_PREFIX = "gv_last_gps_v2:";

function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
export function isDuplicateGpsReading(previous, current) {
  return previous && previous.fechaGps === current.fechaGps &&
    Number(previous.latitud) === Number(current.latitud) && Number(previous.longitud) === Number(current.longitud);
}

function notify(update) {
  statusListener?.({ idViaje: activeTripId, active: isTrackingActive(), connection: navigator.onLine ? "En línea" : "Sin conexión", ...update });
}
async function notifyPending(idViaje, update = {}) { notify({ pending: await countPendingLocations(idViaje), ...update }); }
export function setTrackingStatusListener(listener) { statusListener = listener; }
export function isTrackingActive() { return intervalId !== null || nativeWatcherId !== null; }

export async function syncPendingLocations(idViaje) {
  if (hasNativeGps()) {
    await getPendingLocations(idViaje); // Migrar la cola anterior antes del primer envío nativo.
    await NativeGps.configure(nativeTripOptions(idViaje));
    const result = await NativeGps.sync({ trip: String(idViaje) });
    await notifyPending(idViaje, { status: result.pending ? "Guardado en SQLite; pendiente de sincronizar" : "Sincronizado" });
    return { completed: result.pending === 0, pending: result.pending };
  }
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
      if (rejected.length) {
        diagnostics.record("GPS_SYNC", { code: "LOCATIONS_REJECTED", status: 409 });
        await quarantinePendingLocations(rejected);
      }
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

export async function queueNormalizedLocation(idViaje, location, extraData = {}) {
  try {
    const normalizedId = Number(idViaje) > 0 ? Number(idViaje) : idViaje;
    const isBackground = typeof document !== "undefined" ? Boolean(document.hidden) : false;
    const previous = readJson(LAST_LOCATION_PREFIX + String(normalizedId));
    if (isDuplicateGpsReading(previous, location) && !extraData.esPuntoIntermedio && !extraData.esUbicacionInicial && !extraData.esUbicacionFinal) {
      return { ...previous, duplicate: true };
    }
    const savedAt = new Date().toISOString();
    const pendingLocation = {
      ...location,
      isBackground,
      fechaGuardadoLocal: savedAt,
      ...extraData,
      clientLocationId: uuid(),
      idViaje: normalizedId
    };
    await savePendingLocation(pendingLocation);
    writeJson(LAST_LOCATION_PREFIX + String(normalizedId), pendingLocation);
    await notifyPending(normalizedId, {
      status: extraData.esPuntoIntermedio ? "Punto intermedio capturado" : "Ubicación capturada",
      lastCapture: pendingLocation.fechaGps,
      latitude: pendingLocation.latitud,
      longitude: pendingLocation.longitud,
      isBackground
    });
    await syncPendingLocations(normalizedId);
    return pendingLocation;
  } catch (error) {
    notify({ status: "Sin señal GPS", error: error.message });
    return null;
  }
}

export async function captureAndQueueLocation(idViaje, extraData = {}) {
  try {
    const pendingLocation = await captureAndStoreLocation(idViaje, extraData);
    await syncPendingLocations(idViaje);
    return pendingLocation;
  } catch (error) {
    diagnostics.record("GPS_ERROR", { code: "CAPTURE_FAILED" });
    notify({ status: "Sin señal GPS", error: error.message }); return null;
  }
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
    const normalizedId = Number(idViaje) > 0 ? Number(idViaje) : idViaje;
    const location = await getCurrentLocation();
    const isBackground = typeof document !== "undefined" ? Boolean(document.hidden) : false;
    const previous = readJson(LAST_LOCATION_PREFIX + String(normalizedId));
    if (isDuplicateGpsReading(previous, location) && !extraData.esPuntoIntermedio && !extraData.esUbicacionInicial && !extraData.esUbicacionFinal) {
      return { ...previous, duplicate: true };
    }
    const savedAt = new Date().toISOString();
    const pendingLocation = { ...location, isBackground, fechaGuardadoLocal: savedAt, ...extraData,
      clientLocationId: uuid(), idViaje: normalizedId };
    await savePendingLocation(pendingLocation);
    writeJson(LAST_LOCATION_PREFIX + String(normalizedId), pendingLocation);
    await notifyPending(normalizedId, {
      status: extraData.esPuntoIntermedio ? "Punto intermedio capturado" : "Ubicación capturada",
      lastCapture: pendingLocation.fechaGps,
      latitude: pendingLocation.latitud,
      longitude: pendingLocation.longitud,
      isBackground
    });
    return pendingLocation;
  })();
  try { return await capturePromise; }
  finally { capturePromise = null; }
}

export async function captureInitialTripLocation(idViaje) {
  try {
    if (hasNativeGps()) await NativeGps.ensurePermissions();
    return await captureAndStoreLocation(idViaje, { esUbicacionInicial: true });
  } catch (error) {
    diagnostics.record("GPS_ERROR", { code: "INITIAL_CAPTURE_FAILED" });
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

async function startNativeWatcher(normalizedId) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const watcherId = await BackgroundGeolocationPlugin.addWatcher(
        {
          backgroundTitle: "Gerenciamiento de Viajes",
          backgroundMessage: "Rastreando ubicación del viaje en segundo plano...",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10
        },
        async (rawLocation, err) => {
          if (err) {
            console.error("[BackgroundGeolocation] Error:", err);
            notify({ status: "Error en GPS nativo", error: err.message || String(err) });
            return;
          }
          if (rawLocation) {
            try {
              const normLoc = normalizeLocation({
                latitude: rawLocation.latitude,
                longitude: rawLocation.longitude,
                accuracy: rawLocation.accuracy,
                speed: rawLocation.speed,
                heading: rawLocation.bearing,
                timestamp: rawLocation.time
              });
              await queueNormalizedLocation(normalizedId, normLoc);
            } catch (e) {
              console.warn("[BackgroundGeolocation] Error procesando posición:", e);
            }
          }
        }
      );
      return watcherId;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  throw lastErr;
}

export async function startTracking(idViaje, { captureImmediately = true } = {}) {
  const normalizedId = Number(idViaje) > 0 ? Number(idViaje) : idViaje;
  if (isStarting) return;
  if (isTrackingActive() && activeTripId === normalizedId) {
    if (captureImmediately) await captureAndQueueLocation(normalizedId);
    return;
  }

  isStarting = true;
  try {
    stopTracking({ clearState: false });
    const generation = ++trackingGeneration;
    activeTripId = normalizedId;
    saveTrackingState({ idViaje: normalizedId, trackingActivo: true, intervaloMs: TRACKING_INTERVAL_MS, iniciadoEn: new Date().toISOString() });

    if (hasNativeGps()) {
      await getPendingLocations(normalizedId);
      await NativeGps.start(nativeTripOptions(normalizedId));
      nativeWatcherId = "sqlite";
      if (captureImmediately) await captureAndQueueLocation(normalizedId);
      intervalId = window.setInterval(async () => {
        if (generation !== trackingGeneration) return;
        const state = await NativeGps.status({ trip: String(normalizedId) }).catch(() => null);
        if (!state) return;
        notify({ status: state.gpsStatus, pending: state.pending, lastCapture: state.lastLocation?.fechaGps,
          latitude: state.lastLocation?.latitud, longitude: state.lastLocation?.longitud });
      }, 5000);
      await notifyPending(normalizedId, { status: "Seguimiento nativo con SQLite" });
      return;
    }
    
    // Intento 1: Si es nativo (Android APK / iOS), usar el servicio Foreground Service de segundo plano
    if (Capacitor.isNativePlatform()) {
      try {
        notify({ status: "Iniciando servicio de rastreo nativo en segundo plano..." });
        nativeWatcherId = await startNativeWatcher(normalizedId);
        console.log("[BackgroundGeolocation] Watcher nativo iniciado con éxito ID:", nativeWatcherId);
      } catch (errNative) {
        console.warn("[BackgroundGeolocation] Fallback a bucle de audio silencioso:", errNative);
      }
    }

    // Mantener audio keep-alive como refuerzo y temporizador periódico
    void startSilentAudioKeepAlive().catch(() => {});

    notify({ status: "Esperando permiso" });
    if (captureImmediately) await captureAndQueueLocation(normalizedId);
    intervalId = window.setInterval(() => {
      if (generation === trackingGeneration) void captureAndQueueLocation(normalizedId);
    }, TRACKING_INTERVAL_MS);
    await notifyPending(normalizedId, { 
      status: nativeWatcherId ? "Activo (Servicio nativo en 2º plano)" : "Activo" 
    });
  } finally {
    isStarting = false;
  }
}

export function stopTracking({ clearState = true } = {}) {
  trackingGeneration += 1;
  if (nativeWatcherId !== null) {
    if (nativeWatcherId === "sqlite") {
      if (clearState) void NativeGps.stop().catch(() => {});
    } else BackgroundGeolocationPlugin.removeWatcher({ id: nativeWatcherId }).catch(() => {});
    nativeWatcherId = null;
  }
  if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
  if (clearState) clearTrackingState();
  activeTripId = null;
  // Detener y liberar audio silencioso y estado de multimedia en móvil
  stopSilentAudioKeepAlive();
  notify({ status: "Detenido" });
}
