import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import { confirmSupervisorEmail, getSupervisorAccess, registerSupervisor, sendSupervisorWelcomeEmail, SupervisorTelegramError } from "../services/supervisor-telegram.service.js";

function telegramData(request) { return validateTelegramInitData(request.get("X-Telegram-Init-Data") || request.body?.initData || "", { botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN, maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600) }); }
function requiresEmailConfirmation() { return String(process.env.SUPERVISOR_REQUIRE_EMAIL_CONFIRMATION) === "true"; }
export async function supervisorAccessController(request, response) {
  try { const data = await getSupervisorAccess(telegramData(request).user.id); return response.json({ success: true, data }); }
  catch (error) { return response.status(401).json({ success: false, message: error.message }); }
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
export async function confirmSupervisorEmailController(request, response) {
  try { await confirmSupervisorEmail(request.query.token); return response.status(200).send("Correo confirmado. Regresa a Telegram y abre nuevamente la Mini App."); }
  catch (error) { return response.status(error instanceof SupervisorTelegramError ? error.statusCode : 500).send(error.message || "No fue posible confirmar el correo."); }
}
