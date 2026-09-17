import { crearReporteSiniestro } from "./api.js";
import {
  getPendingSiniestros,
  removePendingSiniestro,
  countPendingSiniestros
} from "./siniestro-storage.js";

let isSyncing = false;
const syncListeners = new Set();

/**
 * Registra un callback que se notifica cuando se completa la sincronización.
 */
export function onSiniestroSyncEvent(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncListeners(result) {
  syncListeners.forEach((cb) => {
    try {
      cb(result);
    } catch (err) {
      console.error("Error en listener de sincronización de siniestros:", err);
    }
  });
}

/**
 * Procesa la cola de reportes de siniestro pendientes y los envía al servidor.
 */
export async function syncPendingSiniestros() {
  if (isSyncing) {
    return { syncing: true, count: 0 };
  }

  if (!navigator.onLine) {
    const remaining = await countPendingSiniestros();
    return { synced: 0, remaining };
  }

  isSyncing = true;
  let synced = 0;
  let remaining = 0;

  try {
    const pendingList = await getPendingSiniestros();
    if (pendingList.length === 0) {
      isSyncing = false;
      return { synced: 0, remaining: 0 };
    }

    console.log(`📡 Sincronizando ${pendingList.length} reporte(s) de siniestro pendientes...`);

    for (const item of pendingList) {
      try {
        const response = await crearReporteSiniestro(item.payload);
        if (response?.success) {
          await removePendingSiniestro(item.idLocal);
          synced++;
        } else {
          console.warn(`Respuesta no exitosa al enviar siniestro ${item.idLocal}:`, response?.message);
        }
      } catch (err) {
        console.error(`Error de red al enviar siniestro pendiente ${item.idLocal}:`, err);
        // Si hay fallo de red, abortar el bucle para no reintentar continuamente en este ciclo
        if (!navigator.onLine || err.code === "NETWORK_ERROR" || err.code === "NETWORK_TIMEOUT") {
          break;
        }
      }
    }

    remaining = await countPendingSiniestros();
    const result = { synced, remaining };

    if (synced > 0) {
      notifySyncListeners(result);
    }

    return result;
  } finally {
    isSyncing = false;
  }
}

/**
 * Inicializa los listeners globales para sincronizar automáticamente al detectar conexión a internet.
 */
export function initSiniestroAutoSync(onSyncSuccess) {
  if (typeof window === "undefined") return () => {};

  if (onSyncSuccess) {
    onSiniestroSyncEvent(onSyncSuccess);
  }

  const handleOnline = () => {
    console.log("🌐 Conexión restablecida: intentando sincronizar reportes de siniestro offline...");
    setTimeout(() => {
      void syncPendingSiniestros();
    }, 1500);
  };

  window.addEventListener("online", handleOnline);

  // Intentar sincronización inicial si ya hay conexión
  if (navigator.onLine) {
    setTimeout(() => {
      void syncPendingSiniestros();
    }, 2000);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
