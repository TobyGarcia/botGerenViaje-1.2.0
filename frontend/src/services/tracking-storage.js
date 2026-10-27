import { diagnostics } from "./client-diagnostics.js";
import { NativeGps, hasNativeGps } from "./native-gps.js";

const DATABASE_NAME = "gerenciamiento_viajes_offline";
const DATABASE_VERSION = 2;
const STORE_NAME = "ubicaciones_pendientes";
const REJECTED_STORE_NAME = "ubicaciones_rechazadas";

function openTrackingDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "clientLocationId" });
      if (!store.indexNames.contains("idViaje")) store.createIndex("idViaje", "idViaje");
      if (!store.indexNames.contains("fechaGps")) store.createIndex("fechaGps", "fechaGps");
      if (!database.objectStoreNames.contains(REJECTED_STORE_NAME)) {
        database.createObjectStore(REJECTED_STORE_NAME, { keyPath: "clientLocationId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { diagnostics.record("GPS_STORAGE_ERROR", { code: "INDEXEDDB_OPEN_FAILED" }); reject(request.error); };
  });
}

async function withStore(mode, callback) {
  const database = await openTrackingDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      callback(store, (value) => { result = value; });
    });
  } catch (error) {
    diagnostics.record("GPS_STORAGE_ERROR", { code: "INDEXEDDB_TRANSACTION_FAILED" });
    throw error;
  } finally { database.close(); }
}

let nativeMigration;
async function migrateToNative() {
  if (!nativeMigration) nativeMigration = (async () => {
    const database = await openTrackingDatabase();
    try {
      for (const name of [STORE_NAME, REJECTED_STORE_NAME]) {
        const records = await new Promise((resolve, reject) => {
          const transaction = database.transaction(name, "readonly");
          const request = transaction.objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        for (let offset = 0; offset < records.length; offset += 100) {
          const points = records.slice(offset, offset + 100);
          await NativeGps.storage({ operation: "import", points });
          if (name === REJECTED_STORE_NAME) await NativeGps.storage({ operation: "quarantine", ids: points.map(p => p.clientLocationId) });
        }
        // Importación idempotente. El original solo se elimina tras confirmar SQLite.
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(name, "readwrite");
          for (const record of records) transaction.objectStore(name).delete(record.clientLocationId);
          transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
        });
      }
    } finally { database.close(); }
  })().catch(error => { nativeMigration = null; throw error; });
  return nativeMigration;
}

export async function savePendingLocation(location) {
  if (hasNativeGps()) { await migrateToNative(); return NativeGps.storage({ operation: "save", point: location }); }
  return withStore("readwrite", (store) => store.put(location));
}
export async function countAllStoredLocations() {
  if (hasNativeGps()) { await migrateToNative(); const state = await NativeGps.status({}); return state.stored + (state.active ? 1 : 0); }
  const database = await openTrackingDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME, REJECTED_STORE_NAME], "readonly");
      let total = 0;
      for (const name of [STORE_NAME, REJECTED_STORE_NAME]) {
        const request = transaction.objectStore(name).count();
        request.onsuccess = () => { total += request.result; };
      }
      transaction.oncomplete = () => resolve(total);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
export async function getPendingLocations(idViaje) {
  if (hasNativeGps()) { await migrateToNative(); return (await NativeGps.storage({ operation: "pending", trip: String(idViaje) })).points; }
  const key = Number(idViaje) > 0 ? Number(idViaje) : idViaje;
  return withStore("readonly", (store, setResult) => {
    const request = store.index("idViaje").getAll(key);
    request.onsuccess = () => setResult(request.result.sort((a, b) => new Date(a.fechaGps) - new Date(b.fechaGps)));
  });
}
export async function removePendingLocations(ids) {
  if (hasNativeGps()) { await migrateToNative(); return NativeGps.storage({ operation: "remove", ids }); }
  return ids.length ? withStore("readwrite", (store) => ids.forEach((id) => store.delete(id))) : Promise.resolve();
}
export async function quarantinePendingLocations(locations) {
  if (hasNativeGps()) { await migrateToNative(); return NativeGps.storage({ operation: "quarantine", ids: locations.map(p => p.clientLocationId) }); }
  if (!locations.length) return;
  const database = await openTrackingDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME, REJECTED_STORE_NAME], "readwrite");
      const pending = transaction.objectStore(STORE_NAME);
      const rejected = transaction.objectStore(REJECTED_STORE_NAME);
      for (const location of locations) {
        rejected.put({ ...location, rechazadoEn: new Date().toISOString() });
        pending.delete(location.clientLocationId);
      }
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
export async function countPendingLocations(idViaje) { return (await getPendingLocations(idViaje)).length; }
export async function clearPendingLocations(idViaje) {
  if (hasNativeGps()) throw new Error("Las capturas SQLite solo se retiran por confirmación del servidor.");
  const key = Number(idViaje) > 0 ? Number(idViaje) : idViaje;
  return withStore("readwrite", (store) => {
    const request = store.index("idViaje").openKeyCursor(IDBKeyRange.only(key));
    request.onsuccess = () => { const cursor = request.result; if (cursor) { store.delete(cursor.primaryKey); cursor.continue(); } };
  });
}
