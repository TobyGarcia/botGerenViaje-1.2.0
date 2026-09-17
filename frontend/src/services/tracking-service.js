import { registrarUbicacionesLote } from "./api.js";
import { getCurrentLocation } from "./location-provider.js";
import { countPendingLocations, getPendingLocations, removePendingLocations, savePendingLocation } from "./tracking-storage.js";
import { clearTrackingState, getTrackingState, saveTrackingState } from "./tracking-state.js";
import { startSilentAudioKeepAlive, stopSilentAudioKeepAlive } from "./background-audio.js";

const intervalValue = Number(import.meta.env.VITE_GPS_TRACKING_INTERVAL_MS);
const batchValue = Number(import.meta.env.VITE_GPS_SYNC_BATCH_SIZE);
const TRACKING_INTERVAL_MS = Number.isFinite(intervalValue) && intervalValue >= 1000 ? intervalValue : 30000;
const SYNC_BATCH_SIZE = Number.isFinite(batchValue) && batchValue > 0 ? Math.min(batchValue, 200) : 100;
const MIN_CAPTURE_COOLDOWN_MS = 15000; // Mínimo 15 segundos entre capturas automáticas

let intervalId = null;
let activeTripId = null;
let syncPromise = null;
let statusListener = null;
let isStarting = false;
let watchId = null;
let workerTimer = null;

let lastCapturedTime = 0;
let lastCapturedLat = null;
let lastCapturedLng = null;
let isCapturing = false;

function notify(update) {
  statusListener?.({ idViaje: activeTripId, active: isTrackingActive(), connection: navigator.onLine ? "En línea" : "Sin conexión", ...update });
}

async function notifyPending(idViaje, update = {}) { 
  notify({ pending: await countPendingLocations(idViaje), ...update }); 
}

export function setTrackingStatusListener(listener) { statusListener = listener; }
export function isTrackingActive() { return intervalId !== null || workerTimer !== null || watchId !== null; }

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

export async function captureAndQueueLocation(idViaje, extraData = {}) {
  const isIntermediate = Boolean(extraData.esPuntoIntermedio);
  const now = Date.now();

  // Control de cooldown y desduplicación para capturas automáticas
  if (!isIntermediate) {
    if (isCapturing) return null; // Evitar llamadas concurrentes solapadas
    if (now - lastCapturedTime < MIN_CAPTURE_COOLDOWN_MS) {
      return null; // Omitir si fue capturado hace menos de 15 segundos
    }
  }

  isCapturing = true;
  try {
    const location = await getCurrentLocation();
    
    // Omitir si las coordenadas son idénticas y se capturó recientemente
    if (!isIntermediate && lastCapturedLat === location.latitud && lastCapturedLng === location.longitud && (now - lastCapturedTime < 45000)) {
      lastCapturedTime = now;
      return null;
    }

    lastCapturedTime = now;
    lastCapturedLat = location.latitud;
    lastCapturedLng = location.longitud;

    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const isBackground = typeof document !== "undefined" ? Boolean(document.hidden) : false;
    const pendingLocation = {
      ...location,
      isBackground,
      ...extraData,
      clientLocationId: uuid,
      idViaje: Number(idViaje)
    };
    await savePendingLocation(pendingLocation);
    await notifyPending(idViaje, {
      status: extraData.esPuntoIntermedio ? "Punto intermedio capturado" : "Ubicación capturada",
      lastCapture: pendingLocation.fechaGps,
      latitude: pendingLocation.latitud,
      longitude: pendingLocation.longitud,
      isBackground
    });
    await syncPendingLocations(idViaje);
    return pendingLocation;
  } catch (error) { 
    notify({ status: "Sin señal GPS", error: error.message }); 
    return null; 
  } finally {
    isCapturing = false;
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

function startWorkerTimer(callback, intervalMs) {
  stopWorkerTimer();
  if (typeof window === "undefined" || typeof Worker === "undefined") return false;
  try {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.action === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, e.data.intervalMs || 30000);
        } else if (e.data.action === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    workerTimer = new Worker(url);
    workerTimer.onmessage = function(e) {
      if (e.data === "tick") {
        callback();
      }
    };
    workerTimer.postMessage({ action: "start", intervalMs });
    return true;
  } catch (err) {
    console.warn("[TrackingService] No se pudo crear Web Worker Timer:", err?.message);
    return false;
  }
}

function stopWorkerTimer() {
  if (workerTimer) {
    try {
      workerTimer.postMessage({ action: "stop" });
      workerTimer.terminate();
    } catch {}
    workerTimer = null;
  }
}

export async function startTracking(idViaje) {
  const normalizedId = Number(idViaje);
  if (isStarting || (isTrackingActive() && activeTripId === normalizedId)) return;

  isStarting = true;
  try {
    stopTracking({ clearState: false });
    activeTripId = normalizedId;
    lastCapturedTime = 0;
    lastCapturedLat = null;
    lastCapturedLng = null;

    saveTrackingState({ idViaje: normalizedId, trackingActivo: true, intervaloMs: TRACKING_INTERVAL_MS, iniciadoEn: new Date().toISOString() });
    
    // Iniciar mantenimiento de audio en segundo plano
    void startSilentAudioKeepAlive().catch(() => {});

    notify({ status: "Esperando permiso" });
    await captureAndQueueLocation(normalizedId);
    
    // Usar Web Worker Timer si está disponible; si no, recurrir a setInterval
    const startedWorker = startWorkerTimer(() => { captureAndQueueLocation(normalizedId); }, TRACKING_INTERVAL_MS);
    if (!startedWorker) {
      intervalId = window.setInterval(() => { captureAndQueueLocation(normalizedId); }, TRACKING_INTERVAL_MS);
    }

    // Listener nativo del sistema operativo (watchPosition) para cambios de movimiento GPS
    if (typeof navigator !== "undefined" && "geolocation" in navigator && !watchId) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            captureAndQueueLocation(normalizedId);
          },
          (err) => {
            console.warn("[TrackingService] watchPosition aviso:", err?.message);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 25000 }
        );
      } catch (e) {
        console.warn("[TrackingService] Error al registrar watchPosition:", e?.message);
      }
    }

    await notifyPending(normalizedId, { status: "Activo" });
  } finally {
    isStarting = false;
  }
}

export function stopTracking({ clearState = true } = {}) {
  if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
  stopWorkerTimer();
  if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    try { navigator.geolocation.clearWatch(watchId); } catch {}
    watchId = null;
  }
  if (clearState) clearTrackingState();
  activeTripId = null;
  stopSilentAudioKeepAlive();
  notify({ status: "Detenido" });
}

export async function resumeTrackingIfNeeded() {
  const state = getTrackingState();
  if (state?.trackingActivo && state.idViaje) { await startTracking(state.idViaje); return state.idViaje; }
  return null;
}
