import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getApiBaseUrl, getViajeActivo } from "../services/api.js";
import { countAllStoredLocations } from "../services/tracking-storage.js";
import { apiFetch, readApiJson } from "../services/http-transport.js";
import { watchAndroidUpdates } from "../services/update-checker.js";
import safeStorage from "../utils/safeStorage.js";
import AndroidUpdateDialog from "./AndroidUpdateDialog.jsx";

const AndroidVersion = registerPlugin("AndroidVersion");

export default function AndroidUpdateNotice({ trip, authenticated = false }) {
  const [update, setUpdate] = useState(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const enabled = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  useEffect(() => {
    if (!enabled) return;
    const watcher = watchAndroidUpdates({
      check: async signal => {
        const info = await AndroidVersion.getInfo();
        const response = await apiFetch(`${getApiBaseUrl()}/api/android/update?channel=${encodeURIComponent(info.channel)}`, { signal });
        if (!response.ok) throw new Error("No se pudo consultar la actualización.");
        const available = await readApiJson(response);
        return available.available && available.versionCode > info.versionCode ? available : null;
      },
      onResult: available => setUpdate(available)
    });
    return () => watcher.stop();
  }, [enabled]);

  async function download() {
    setChecking(true);
    try {
      if (trip && !["FINALIZADO", "CANCELADO"].includes(trip.estado)) throw new Error("Termina el viaje antes de actualizar.");
      const state = JSON.parse(localStorage.getItem("gerenciamiento_viajes_tracking_state") || "null");
      if (state?.trackingActivo) throw new Error("El seguimiento GPS sigue activo.");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith("gv_offline_trip_v1:")) {
          const saved = JSON.parse(localStorage.getItem(key) || "null");
          if (saved && (Array.isArray(saved) ? saved.some(record => !record.synced) : !saved.synced)) {
            throw new Error("Sincroniza los viajes guardados antes de actualizar.");
          }
        }
      }
      if (await countAllStoredLocations()) throw new Error("Hay ubicaciones guardadas que requieren sincronización o revisión.");
      const cachedTrip = safeStorage.getJSON("cached_active_trip", null);
      if (cachedTrip && !["FINALIZADO", "CANCELADO"].includes(cachedTrip.estado)) throw new Error("Tienes un viaje guardado pendiente o en curso.");
      if (authenticated || safeStorage.getItem("driver_token")) {
        try {
          const active = await getViajeActivo();
          if (active.data && !["FINALIZADO", "CANCELADO"].includes(active.data.estado)) throw new Error("Tienes un viaje pendiente o en curso.");
        } catch (error) {
          // Antes del PIN se permite reparar la APK con sesión vencida únicamente
          // después de comprobar que no existe viaje local, GPS activo ni cola.
          if (authenticated || error.status !== 401) throw error;
        }
      }
      const url = new URL(update.downloadUrl);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/")) throw new Error("Enlace de actualización inválido.");
      await AndroidVersion.openDownload({ url: url.href });
      setMessage("Confirma la instalación en Android cuando termine la descarga.");
    } catch (error) { setMessage(error.message || "No fue posible verificar los datos pendientes."); }
    finally { setChecking(false); }
  }

  if (!enabled || !update || Date.now() < snoozedUntil) return null;
  return <AndroidUpdateDialog version={update.versionName} checking={checking} message={message} onDownload={download}
    onLater={() => { setSnoozedUntil(Date.now() + 30 * 60000); setMessage(""); }} />;
}
