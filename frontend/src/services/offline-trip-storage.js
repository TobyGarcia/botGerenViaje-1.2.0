const PREFIX = "gv_offline_trip_v1:";
const PERMITS = "gv_offline_permits_v1:";

export function durableWrite(key, value) {
  const text = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, text);
    if (window.localStorage.getItem(key) !== text) throw new Error("write failed");
  } catch {
    throw new Error("No se pudo guardar en el teléfono. Libera espacio y habilita el almacenamiento antes de iniciar sin conexión.");
  }
}
function read(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; }
}
export const getOfflineTrip = driverId => read(PREFIX + driverId);
export const saveOfflineTrip = trip => durableWrite(PREFIX + trip.trip.idConductor, trip);
export const getOfflinePermits = driverId => read(PERMITS + driverId) || [];
export const saveOfflinePermits = (driverId, permits) => durableWrite(PERMITS + driverId, permits);
export function storeServerMapping(localId, serverId, driverId) {
  durableWrite(`gv_offline_mapping:${localId}`, { serverId, driverId });
}
export function resolveOfflineTripId(localId) {
  if (Number(localId) > 0) return Number(localId);
  const mapping = read(`gv_offline_mapping:${localId}`);
  const driver = read("cached_driver");
  return mapping && Number(driver?.id_conductores) === Number(mapping.driverId) ? mapping.serverId : null;
}

export function uuid() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Se requiere un navegador seguro para guardar viajes sin conexión.");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export function matchingPermit(permits, driverId, vehicleId, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(at).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = +parts.hour * 60 + +parts.minute;
  if (minutes < 390 || minutes >= 1080) return null;
  return permits.find(p => Number(p.driverId) === Number(driverId) && Number(p.vehicleId) === Number(vehicleId) &&
    p.day === day && +at >= +new Date(p.issuedAt) && +at < +new Date(p.expiresAt)) || null;
}

export function offlineTripView(record) {
  return { ...record.display, idViaje: record.localId, id_viajes: record.localId,
    folio: record.serverTrip?.folio || `LOCAL-${record.clientId.slice(0, 8).toUpperCase()}`,
    estado: record.finishedAt ? "FINALIZADO" : record.startedAt ? "EN_CURSO" : "PENDIENTE",
    horaSalida: record.startedAt, horaLlegada: record.finishedAt,
    kilometrajeInicial: record.trip.kilometrajeInicial, kilometrajeFinal: record.kilometrajeFinal,
    offline: true, offlineSynced: Boolean(record.synced), idConductor: record.trip.idConductor };
}
