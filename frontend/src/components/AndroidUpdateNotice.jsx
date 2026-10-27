import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getApiBaseUrl, getViajeActivo } from "../services/api.js";
import { countAllStoredLocations } from "../services/tracking-storage.js";

const AndroidVersion = registerPlugin("AndroidVersion");

export default function AndroidUpdateNotice({ trip }) {
  const [update, setUpdate] = useState(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    (async () => {
      const info = await AndroidVersion.getInfo();
      const response = await fetch(`${getApiBaseUrl()}/api/android/update?channel=${encodeURIComponent(info.channel)}`, { signal: controller.signal });
      if (!response.ok) return;
      const available = await response.json();
      if (!controller.signal.aborted && available.available && available.versionCode > info.versionCode) setUpdate(available);
    })().catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

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
      const active = await getViajeActivo();
      if (active.data && !["FINALIZADO", "CANCELADO"].includes(active.data.estado)) throw new Error("Tienes un viaje pendiente o en curso.");
      const url = new URL(update.downloadUrl);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/")) throw new Error("Enlace de actualización inválido.");
      await AndroidVersion.openDownload({ url: url.href });
      setMessage("Confirma la instalación en Android cuando termine la descarga.");
    } catch (error) { setMessage(error.message || "No fue posible verificar los datos pendientes."); }
    finally { setChecking(false); }
  }

  if (!update) return null;
  return <div className="message message-success" role="status">
    <p>Disponible GV Mobility {update.versionName}. Actualiza al terminar y sincronizar tus viajes.</p>
    <button type="button" disabled={checking} onClick={download}>{checking ? "Verificando…" : "Descargar actualización"}</button>
    {message && <p>{message}</p>}
  </div>;
}
