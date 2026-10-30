import { requestOfflinePermits, uploadOfflineTrip } from "./api.js";
import { getOfflineTrip, getOfflineTrips, getSyncableOfflineTrips, saveOfflineTrip, getOfflinePermits, saveOfflinePermits, matchingPermit,
  uuid, offlineTripView, storeServerMapping } from "./offline-trip-storage.js";
import { syncPendingLocations, countPendingForTrip } from "./tracking-service.js";
import { getPendingLocations } from "./tracking-storage.js";
import { durableWrite } from "./offline-trip-storage.js";

function updateLocalMileage(record, mileage) {
  if (getOfflineTrips(record.trip.idConductor).some(other => other.trip.idVehiculo === record.trip.idVehiculo && +new Date(other.startedAt) > +new Date(record.startedAt))) return;
  const vehicles = JSON.parse(window.localStorage.getItem("cached_vehiculos") || "[]");
  if (!Array.isArray(vehicles)) return;
  durableWrite("cached_vehiculos", vehicles.map(vehicle => String(vehicle.id_vehiculos) === String(record.trip.idVehiculo)
    ? { ...vehicle, kilometraje_actual: record.trip.odometerCorrection ? mileage : Math.max(Number(vehicle.kilometraje_actual || 0), mileage) } : vehicle));
}

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
  const existing = getOfflineTrips(trip.idConductor).find(record => !record.synced && !record.finishedAt);
  if (existing) throw new Error("Primero finaliza el viaje activo guardado en este teléfono.");
  const permit = matchingPermit(getOfflinePermits(trip.idConductor), trip.idConductor, trip.idVehiculo);
  if (!permit) throw new Error("No hay un permiso vigente guardado para este conductor y vehículo. Se requiere conexión para registrar la inspección vehicular previa del día.");
  const clientId = uuid();
  const record = { clientId, localId: -(Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000),
    permit: permit.token, grant: permit, trip, display };
  saveOfflineTrip(record);
  return offlineTripView(record);
}

export function startOfflineTrip(driverId, localId, initialLocation) {
  const record = getOfflineTrip(driverId, localId);
  if (!record || record.localId !== localId || record.finishedAt) throw new Error("No se encontró el viaje local pendiente.");
  if (record.startedAt) { updateLocalMileage(record, record.kilometrajeFinal ?? record.trip.kilometrajeInicial); return offlineTripView(record); }
  if (!matchingPermit([record.grant], driverId, record.trip.idVehiculo)) throw new Error("El permiso del día venció. Conéctate para validar la inspección y el horario.");
  if (!initialLocation?.clientLocationId || Number(initialLocation.idViaje) !== Number(localId)) {
    throw new Error("Se requiere guardar la primera ubicación GPS antes de iniciar el viaje.");
  }
  record.startedAt = new Date().toISOString();
  record.initialLocation = initialLocation;
  saveOfflineTrip(record); // Persist BEFORE displaying success or starting GPS.
  updateLocalMileage(record, record.trip.kilometrajeInicial);
  return offlineTripView(record);
}

export function finishOfflineTrip(driverId, localId, mileage) {
  const record = getOfflineTrip(driverId, localId);
  if (!record || record.localId !== localId || !record.startedAt) throw new Error("No se encontró el viaje local iniciado.");
  if (!Number.isSafeInteger(mileage) || mileage <= record.trip.kilometrajeInicial) throw new Error("El kilometraje final debe superar el inicial.");
  if (!record.finishedAt) {
    record.finishedAt = new Date().toISOString(); record.kilometrajeFinal = mileage;
    saveOfflineTrip(record);
  }
  updateLocalMileage(record, record.kilometrajeFinal);
  return offlineTripView(record);
}

export function discardOfflineDraft(driverId, localId) {
  const record = getOfflineTrip(driverId, localId);
  if (!record || record.localId !== localId || record.startedAt) throw new Error("Un viaje iniciado debe finalizarse y sincronizarse; no se puede descartar.");
  saveOfflineTrip({ ...record, synced: true });
}

const syncing = new Map();
export async function syncOfflineTrip(driverId) {
  if (syncing.has(driverId)) return syncing.get(driverId);
  const operation = (async () => {
    if (!navigator.onLine) throw new Error("Sin conexión. Los datos siguen guardados en este teléfono.");
    const failures = [];
    const candidates = getSyncableOfflineTrips(driverId);
    for (const candidate of candidates) {
      try {
      const pendingLocations = candidate.initialLocation ? [] : await getPendingLocations(candidate.localId);
      const initialLocation = candidate.initialLocation || pendingLocations[0];
      if (!initialLocation) throw new Error("El viaje local no tiene una ubicación GPS inicial guardada y requiere revisión.");
      const response = await uploadOfflineTrip({ clientId: candidate.clientId, permit: candidate.permit, trip: candidate.trip,
        startedAt: candidate.startedAt, initialLocation,
        finishedAt: candidate.finishedAt, kilometrajeFinal: candidate.kilometrajeFinal });
      // El conductor puede terminar este viaje mientras la petición está en curso.
      const latest = getOfflineTrip(driverId, candidate.localId);
      if (!latest || latest.clientId !== candidate.clientId) throw new Error("El viaje local cambió durante la sincronización.");
      const finishAcknowledged = Boolean(candidate.finishedAt && latest.finishedAt === candidate.finishedAt);
      let record = { ...latest, serverTrip: response.data };
      storeServerMapping(record.localId, response.data.idViaje, driverId);
      saveOfflineTrip(record);
      const gpsSync = await syncPendingLocations(record.localId);
      const serverClosed = ["FINALIZADO", "CANCELADO"].includes(response.data.estado);
      if (gpsSync.error) throw gpsSync.error;
      if (!gpsSync.completed || await countPendingForTrip(record.localId) !== 0) {
        throw new Error("Quedan ubicaciones pendientes de confirmar. Vuelve a sincronizar con conexión.");
      }
      if (serverClosed && (finishAcknowledged || !latest.finishedAt)) {
        record = { ...getOfflineTrip(driverId, candidate.localId), synced: true };
        saveOfflineTrip(record);
      }
      } catch (error) {
        failures.push(`${candidate.serverTrip?.folio || "Viaje guardado"}: ${error.message}`);
      }
    }
    if (failures.length) throw new Error(failures.join(" "));
    return getOfflineTrip(driverId);
  })();
  syncing.set(driverId, operation);
  try { return await operation; } finally { syncing.delete(driverId); }
}
