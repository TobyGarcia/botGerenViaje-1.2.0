import { requestOfflinePermits, uploadOfflineTrip } from "./api.js";
import { getOfflineTrip, saveOfflineTrip, getOfflinePermits, saveOfflinePermits, matchingPermit,
  uuid, offlineTripView, storeServerMapping } from "./offline-trip-storage.js";
import { syncPendingLocations, countPendingForTrip } from "./tracking-service.js";

export async function refreshOfflinePermits(driverId) {
  if (!navigator.onLine || !driverId) return;
  try {
    const response = await requestOfflinePermits();
    saveOfflinePermits(driverId, response.data || []);
  } catch (error) {
    if ([401, 403].includes(error.status)) saveOfflinePermits(driverId, []);
    throw error;
  }
}

export function createOfflineDraft(trip, display) {
  const existing = getOfflineTrip(trip.idConductor);
  if (existing && !existing.synced) throw new Error("Primero sincroniza el viaje guardado en este teléfono.");
  const permit = matchingPermit(getOfflinePermits(trip.idConductor), trip.idConductor, trip.idVehiculo);
  if (!permit) throw new Error("No hay un permiso vigente guardado para este conductor y vehículo. Se requiere conexión para registrar la inspección vehicular previa del día.");
  const clientId = uuid();
  const record = { clientId, localId: -(Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000),
    permit: permit.token, grant: permit, trip, display };
  saveOfflineTrip(record);
  return offlineTripView(record);
}

export function startOfflineTrip(driverId, localId) {
  const record = getOfflineTrip(driverId);
  if (!record || record.localId !== localId || record.finishedAt) throw new Error("No se encontró el viaje local pendiente.");
  if (record.startedAt) return offlineTripView(record);
  if (!matchingPermit([record.grant], driverId, record.trip.idVehiculo)) throw new Error("El permiso del día venció. Conéctate para validar la inspección y el horario.");
  record.startedAt = new Date().toISOString();
  saveOfflineTrip(record); // Persist BEFORE displaying success or starting GPS.
  return offlineTripView(record);
}

export function finishOfflineTrip(driverId, localId, mileage) {
  const record = getOfflineTrip(driverId);
  if (!record || record.localId !== localId || !record.startedAt) throw new Error("No se encontró el viaje local iniciado.");
  if (!Number.isSafeInteger(mileage) || mileage <= record.trip.kilometrajeInicial) throw new Error("El kilometraje final debe superar el inicial.");
  if (!record.finishedAt) {
    record.finishedAt = new Date().toISOString(); record.kilometrajeFinal = mileage;
    saveOfflineTrip(record);
  }
  return offlineTripView(record);
}

export function discardOfflineDraft(driverId, localId) {
  const record = getOfflineTrip(driverId);
  if (!record || record.localId !== localId || record.startedAt) throw new Error("Un viaje iniciado debe finalizarse y sincronizarse; no se puede descartar.");
  saveOfflineTrip({ ...record, synced: true });
}

const syncing = new Map();
export async function syncOfflineTrip(driverId) {
  if (syncing.has(driverId)) return syncing.get(driverId);
  const operation = (async () => {
    let record = getOfflineTrip(driverId);
    if (!navigator.onLine || !record?.startedAt || record.synced) return record;
    const response = await uploadOfflineTrip({ clientId: record.clientId, permit: record.permit, trip: record.trip,
      startedAt: record.startedAt, finishedAt: record.finishedAt, kilometrajeFinal: record.kilometrajeFinal });
    // The driver may finish while the request is in flight: merge into the latest record.
    const latest = getOfflineTrip(driverId);
    if (!latest || latest.clientId !== record.clientId) throw new Error("El viaje local cambió durante la sincronización.");
    const finishAcknowledged = Boolean(record.finishedAt && latest.finishedAt === record.finishedAt);
    record = { ...latest, serverTrip: response.data };
    storeServerMapping(record.localId, response.data.idViaje, driverId);
    saveOfflineTrip(record);
    await syncPendingLocations(record.localId);
    if (finishAcknowledged && await countPendingForTrip(record.localId) === 0) {
      record = { ...getOfflineTrip(driverId), synced: true };
      saveOfflineTrip(record);
    }
    return record;
  })();
  syncing.set(driverId, operation);
  try { return await operation; } finally { syncing.delete(driverId); }
}
