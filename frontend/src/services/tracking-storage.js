const DATABASE_NAME = "gerenciamiento_viajes_offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "ubicaciones_pendientes";

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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
  } finally { database.close(); }
}

export { openTrackingDatabase };
export function savePendingLocation(location) { return withStore("readwrite", (store) => store.put(location)); }
export function getPendingLocations(idViaje) {
  return withStore("readonly", (store, setResult) => {
    const request = store.index("idViaje").getAll(Number(idViaje));
    request.onsuccess = () => setResult(request.result.sort((a, b) => new Date(a.fechaGps) - new Date(b.fechaGps)));
  });
}
export function removePendingLocations(ids) {
  return ids.length ? withStore("readwrite", (store) => ids.forEach((id) => store.delete(id))) : Promise.resolve();
}
export async function countPendingLocations(idViaje) { return (await getPendingLocations(idViaje)).length; }
export function clearPendingLocations(idViaje) {
  return withStore("readwrite", (store) => {
    const request = store.index("idViaje").openKeyCursor(IDBKeyRange.only(Number(idViaje)));
    request.onsuccess = () => { const cursor = request.result; if (cursor) { store.delete(cursor.primaryKey); cursor.continue(); } };
  });
}
