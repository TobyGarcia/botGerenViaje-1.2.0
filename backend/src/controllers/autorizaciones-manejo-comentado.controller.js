import {
  decideManejoComentadoAuthorization,
  getManejoComentadoAuthorizationTripData,
  listPendingManejoComentadoAuthorizations
} from "../services/autorizaciones-manejo-comentado.service.js";
import { sendDriverManejoComentadoAuthorizationNotification } from "../bot/bot.js";
import { getSupervisorAccess } from "../services/supervisor-telegram.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";

const ROLES_AUTORIZADORES = ["ADMINISTRADOR", "ADMIN", "GERENTE", "GERENTE_GENERAL"];

async function requireManejoComentadoAuthorizer(request) {
  let user = request.adminUser;
  if (!user) {
    const telegramData = validateTelegramInitData(request.get("X-Telegram-Init-Data") || "", {
      botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN,
      maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
    });
    const access = await getSupervisorAccess(telegramData.user.id);
    user = access?.confirmed && access?.user?.activo ? access.user : null;
  }
  if (!user?.activo || !ROLES_AUTORIZADORES.includes(user.rol)) {
    throw Object.assign(new Error("Sólo Gerente o Administrador puede autorizar un viaje con manejo comentado vencido."), { statusCode: 403 });
  }
  return user;
}

export async function listManejoComentadoAuthorizationsController(request, response) {
  try {
    await requireManejoComentadoAuthorizer(request);
    return response.json({ success: true, data: await listPendingManejoComentadoAuthorizations() });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function decideManejoComentadoAuthorizationController(request, response) {
  try {
    const user = await requireManejoComentadoAuthorizer(request);
    const idAutorizacion = Number(request.params.idAutorizacion);
    const approved = request.body?.aprobada;
    const comentario = String(request.body?.comentario || "").trim();
    const firma = String(request.body?.firma || "");
    if (!Number.isInteger(idAutorizacion) || idAutorizacion <= 0 || typeof approved !== "boolean") {
      return response.status(400).json({ success: false, message: "La decisión no es válida." });
    }
    if (!firma.startsWith("data:image/png;base64,")) {
      return response.status(400).json({ success: false, message: "La firma del autorizador es obligatoria." });
    }
    const decision = await decideManejoComentadoAuthorization({ idAutorizacion, idUsuarioAdmin: user.id_usuarios_admin, approved, comentario, firma });
    if (!decision) return response.status(409).json({ success: false, message: "La solicitud ya fue atendida." });
    const trip = await getManejoComentadoAuthorizationTripData(idAutorizacion);
    await sendDriverManejoComentadoAuthorizationNotification({ telegramUserId: trip?.telegram_user_id, approved, trip, comment: comentario });
    return response.json({ success: true, data: decision, message: approved ? "Autorización aprobada. El conductor ya puede iniciar el viaje." : "Autorización rechazada y conductor notificado." });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message || "No fue posible resolver la autorización." });
  }
}
