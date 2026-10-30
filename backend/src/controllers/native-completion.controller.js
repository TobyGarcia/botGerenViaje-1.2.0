import { completeNativeTrip } from "../services/native-completion.service.js";
import { sendTripGroupAlert } from "../bot/bot.js";
export async function nativeCompletionController(request, response) {
  const id = Number(request.params.idViaje);
  if (!Number.isSafeInteger(id) || id <= 0) return response.status(400).json({ success: false, message: "Viaje inválido." });
  try {
    const result = await completeNativeTrip(id, request.driverUser.id_conductores, request.body);
    if (result.notify) await sendTripGroupAlert({ action: request.body.action, trip: result.trip });
    return response.json({ success: true, data: result.trip });
  } catch (error) {
    return response.status(error.code ? 503 : 409).json({ success: false, message: "No se confirmó el cierre. Los datos quedan guardados para reintento o revisión." });
  }
}
