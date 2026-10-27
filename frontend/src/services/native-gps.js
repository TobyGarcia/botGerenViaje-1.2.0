import { Capacitor, registerPlugin } from "@capacitor/core";
import { getApiBaseUrl } from "./api.js";
import safeStorage from "../utils/safeStorage.js";
import { resolveOfflineTripId } from "./offline-trip-storage.js";

export const NativeGps = registerPlugin("NativeGps");
export const hasNativeGps = () => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("NativeGps");

export function nativeTripOptions(idViaje) {
  const driver = safeStorage.getJSON("cached_driver", {});
  const trip = safeStorage.getJSON("cached_active_trip", {});
  return {
    trip: String(idViaje), server: Number(resolveOfflineTripId(idViaje)) || 0,
    driver: Number(driver.id_conductores ?? driver.idConductor), token: safeStorage.getItem("driver_token") || "",
    origin: getApiBaseUrl(), folio: trip.folio || `Viaje ${idViaje}`,
    startedAt: +new Date(trip.horaSalida ?? trip.hora_salida ?? Date.now()), reminderMillis: 2 * 60 * 60 * 1000
  };
}

export async function queueNativeCompletion(trip, { action, kilometrajeFinal }) {
  if (!hasNativeGps()) throw new Error("No está disponible el cierre nativo.");
  const completion = { action, kilometrajeFinal, recordedAt: new Date().toISOString(), clientId: crypto.randomUUID() };
  await NativeGps.configure(nativeTripOptions(trip));
  await NativeGps.storage({ operation: "complete", trip: String(trip), completion });
  await NativeGps.stop();
  void NativeGps.sync({ trip: String(trip) }).catch(() => {});
  return completion;
}
