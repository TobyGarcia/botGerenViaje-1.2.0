import { getOfflinePermits, syncOfflineTrip } from "../services/offline-viajes.service.js";

export async function offlinePermitsController(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, data: await getOfflinePermits(req.driverUser.id_conductores) });
  } catch (error) {
    console.error("No se pudo preparar el permiso offline:", error.message);
    return res.status(503).json({ success: false, message: "No se pudo preparar el inicio sin conexión." });
  }
}

export async function offlineSyncController(req, res) {
  try {
    return res.json({ success: true, data: await syncOfflineTrip(req.body, req.driverUser.id_conductores) });
  } catch (error) {
    const infrastructureError = error.code && !["MILEAGE_DECREASE"].includes(error.code);
    return res.status(infrastructureError ? 503 : 409).json({ success: false,
      message: infrastructureError ? "No se pudo sincronizar. El viaje sigue guardado en el dispositivo." : error.message });
  }
}
