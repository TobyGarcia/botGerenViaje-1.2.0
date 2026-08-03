import { findTelegramUserById } from "../services/telegram-user.service.js";
import { getInspectionRequirement, saveInspection } from "../services/inspecciones.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";

async function authenticateDriver(request) {
  const telegramData = validateTelegramInitData(request.get("X-Telegram-Init-Data") || "", {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
  });
  const telegramUser = await findTelegramUserById(telegramData.user.id);
  if (!telegramUser?.id_conductores || !telegramUser.activo) throw new Error("El usuario no tiene un conductor activo asociado.");
  return telegramUser.id_conductores;
}

export async function getInspectionRequirementController(request, response) {
  try {
    const idViaje = Number(request.params.idViaje);
    const idConductor = await authenticateDriver(request);
    const data = await getInspectionRequirement({ idViaje, idConductor });
    if (!data) return response.status(404).json({ success: false, message: "No se encontró el viaje." });
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(403).json({ success: false, message: error.message });
  }
}

export async function saveInspectionController(request, response) {
  try {
    const idViaje = Number(request.params.idViaje);
    const idConductor = await authenticateDriver(request);
    const body = request.body || {};
    if (!['E','1/4','1/2','3/4','F'].includes(body.combustible)) throw new Error("Selecciona el nivel de combustible.");
    if (!['PERMANENTE','TEMPORAL'].includes(body.tipoAsignacion)) throw new Error("Selecciona el tipo de asignación.");
    if (!body.firma || !String(body.firma).startsWith('data:image/png;base64,')) throw new Error("La firma del conductor es obligatoria.");
    if (!body.checklist || Object.keys(body.checklist).length === 0) throw new Error("Completa el checklist vehicular.");
    const data = await saveInspection({ idViaje, idConductor, data: body });
    return response.status(201).json({ success: true, data, message: "Inspección enviada para aprobación." });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}
