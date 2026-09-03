import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import { confirmSupervisorEmail, getSupervisorAccess, linkExistingSupervisor, linkSupervisorByTenantEmail, registerSupervisor, sendSupervisorWelcomeEmail, SupervisorTelegramError } from "../services/supervisor-telegram.service.js";

function telegramData(request) { return validateTelegramInitData(request.get("X-Telegram-Init-Data") || request.body?.initData || "", { botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN, maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600) }); }
function requiresEmailConfirmation() { return String(process.env.SUPERVISOR_REQUIRE_EMAIL_CONFIRMATION) === "true"; }
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
export async function registerSupervisorController(request, response) {
  try {
    const result = await registerSupervisor({ telegramUserId: telegramData(request).user.id, data: request.body });
    if (result.created && requiresEmailConfirmation()) {
      await sendSupervisorWelcomeEmail({ user: result.user, token: result.confirmationToken });
    }
    return response.status(result.created ? 201 : 200).json({ success: true, data: { registered: true, confirmed: result.confirmed }, message: result.created ? "Registro de supervisor creado y habilitado." : "Tu cuenta ya fue registrada." });
  } catch (error) { const status = error instanceof SupervisorTelegramError ? error.statusCode : 500; if (status === 500) console.error("Registro de supervisor:", error); return response.status(status).json({ success: false, message: error.message || "No fue posible registrar al supervisor." }); }
}
export async function linkExistingSupervisorController(request, response) {
  try {
    const result = await linkExistingSupervisor({ telegramUserId: telegramData(request).user.id, data: request.body });
    if (result.confirmationToken) await sendSupervisorWelcomeEmail({ user: result.user, token: result.confirmationToken });
    return response.json({ success: true, data: { registered: true, confirmed: result.confirmed }, message: result.confirmed ? "Cuenta de supervisor vinculada correctamente." : "Cuenta vinculada. Confirma el correo para activar las aprobaciones." });
  } catch (error) { const status = error instanceof SupervisorTelegramError ? error.statusCode : 500; if (status === 500) console.error("Vinculación de supervisor:", error); return response.status(status).json({ success: false, message: error.message || "No fue posible vincular la cuenta de supervisor." }); }
}
export async function linkSupervisorByEmailController(request, response) {
  try {
    const email = String(request.body?.correo || request.body?.email || "");
    const tgUser = telegramData(request).user;
    const result = await linkSupervisorByTenantEmail({ telegramUserId: tgUser.id, email, telegramUser: tgUser });
    return response.json({ success: true, data: { registered: true, confirmed: result.confirmed, user: result.user }, message: "Acceso de supervisor verificado e ingresado correctamente." });
  } catch (error) { const status = error instanceof SupervisorTelegramError ? error.statusCode : 500; if (status === 500) console.error("Ingreso de supervisor por correo:", error); return response.status(status).json({ success: false, message: error.message || "No fue posible verificar el correo de supervisor." }); }
}
export async function confirmSupervisorEmailController(request, response) {
  try { await confirmSupervisorEmail(request.query.token); return response.status(200).send("Correo confirmado. Regresa a Telegram y abre nuevamente la Mini App."); }
  catch (error) { return response.status(error instanceof SupervisorTelegramError ? error.statusCode : 500).send(error.message || "No fue posible confirmar el correo."); }
}
