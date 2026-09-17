import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import {
  getSupervisorAccess,
  linkSupervisorByTenantEmail,
  SupervisorTelegramError
} from "../services/supervisor-telegram.service.js";

function telegramData(request) {
  return validateTelegramInitData(
    request.get("X-Telegram-Init-Data") || request.body?.initData || "",
    {
      botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN,
      maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
    }
  );
}

export async function supervisorAccessController(request, response) {
  try {
    if (request.adminUser) {
      return response.json({
        success: true,
        data: {
          invited: true,
          registered: true,
          confirmed: true,
          user: request.adminUser
        }
      });
    }

    let telegramUserId = null;
    try {
      telegramUserId = telegramData(request)?.user?.id;
    } catch {
      // initData no enviado
    }

    if (!telegramUserId) {
      return response.status(401).json({
        success: false,
        message: "No se encontró una sesión activa de Microsoft ni datos de Telegram."
      });
    }

    const data = await getSupervisorAccess(telegramUserId);
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(401).json({ success: false, message: error.message });
  }
}

export async function linkSupervisorByEmailController(request, response) {
  try {
    const email = String(request.body?.correo || request.body?.email || "");
    const tgUser = telegramData(request).user;
    const result = await linkSupervisorByTenantEmail({ telegramUserId: tgUser.id, email, telegramUser: tgUser });
    return response.json({
      success: true,
      data: { registered: true, confirmed: result.confirmed, user: result.user },
      message: "Acceso de supervisor verificado e ingresado correctamente."
    });
  } catch (error) {
    const status = error instanceof SupervisorTelegramError ? error.statusCode : 500;
    if (status === 500) console.error("Ingreso de supervisor por correo:", error);
    return response.status(status).json({
      success: false,
      message: error.message || "No fue posible verificar el correo de supervisor."
    });
  }
}
