const DB_NAME = "siniestros_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "siniestros_pendientes";

function openSiniestroDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este entorno."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "idLocal" });
        store.createIndex("timestamp", "timestamp");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fallback a localStorage en caso de que IndexedDB no esté disponible en webviews restrictivos.
 */
function saveToLocalStorageFallback(item) {
  try {
    const raw = localStorage.getItem("siniestros_pendientes_fallback") || "[]";
    const items = JSON.parse(raw);
    items.push(item);
    localStorage.setItem("siniestros_pendientes_fallback", JSON.stringify(items));
    return true;
  } catch (err) {
    console.error("Error guardando reporte de siniestro en localStorage fallback:", err);
    return false;
  }
}

function getFromLocalStorageFallback() {
  try {
    const raw = localStorage.getItem("siniestros_pendientes_fallback") || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function removeFromLocalStorageFallback(idLocal) {
  try {
    const items = getFromLocalStorageFallback().filter(i => i.idLocal !== idLocal);
    localStorage.setItem("siniestros_pendientes_fallback", JSON.stringify(items));
  } catch (err) {
    console.error("Error eliminando reporte de localStorage fallback:", err);
  }
}

/**
 * Guarda un reporte de siniestro localmente en el teléfono (modo offline).
 */
export async function savePendingSiniestro(payload) {
  const item = {
    idLocal: `siniestro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    payload,
    timestamp: new Date().toISOString()
  };

  try {
    const db = await openSiniestroDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      store.put(item);
    });
    db.close();
    return item;
  } catch (err) {
    console.warn("Falling back to localStorage for offline siniestro:", err);
    saveToLocalStorageFallback(item);
    return item;
  }
}

/**
 * Obtiene todos los reportes de siniestro pendientes almacenados localmente.
 */
export async function getPendingSiniestros() {
  let dbItems = [];
  try {
    const db = await openSiniestroDatabase();
    dbItems = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.warn("Error leyendo IndexedDB para siniestros pendientes:", err);
  }

  const localItems = getFromLocalStorageFallback();
  
  // Combinar y deduplicar por idLocal
  const allMap = new Map();
  dbItems.forEach(item => allMap.set(item.idLocal, item));
  localItems.forEach(item => allMap.set(item.idLocal, item));

  const result = Array.from(allMap.values());
  result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return result;
}

/**
 * Elimina un reporte de siniestro enviado exitosamente.
 */
export async function removePendingSiniestro(idLocal) {
  removeFromLocalStorageFallback(idLocal);
  try {
    const db = await openSiniestroDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      store.delete(idLocal);
    });
    db.close();
  } catch (err) {
    console.warn("Error borrando siniestro de IndexedDB:", err);
  }
}

/**
 * Devuelve el número total de reportes pendientes almacenados en el dispositivo.
 */
export async function countPendingSiniestros() {
  const pending = await getPendingSiniestros();
  return pending.length;
}
