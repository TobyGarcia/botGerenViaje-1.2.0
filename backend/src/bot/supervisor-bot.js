import { Markup, Telegraf } from "telegraf";
import {
  getSupervisorAccess,
  registerSupervisorGroupMember
} from "../services/supervisor-telegram.service.js";

let supervisorBotInstance = null;
let supervisorBotStarted = false;

function isSupervisorGroup(context) {
  const groupId = process.env.TELEGRAM_GROUP_SUPRVISOR_ID;
  return Boolean(
    groupId &&
      ["group", "supergroup"].includes(context.chat?.type) &&
      String(context.chat?.id) === String(groupId)
  );
}

function privateBotLink() {
  const username = process.env.TELEGRAM_SUPERVISOR_BOT_USERNAME?.replace(/^@/, "");
  if (!username) throw new Error("TELEGRAM_SUPERVISOR_BOT_USERNAME no está configurado.");
  return `https://t.me/${username}?start=supervisor`;
}

function supervisorMiniAppKeyboard() {
  const url = process.env.TELEGRAM_SUPERVISOR_WEB_APP_URL;
  if (!url) throw new Error("TELEGRAM_SUPERVISOR_WEB_APP_URL no está configurada.");
  return Markup.inlineKeyboard([[Markup.button.webApp("🛡️ Abrir supervisión", url)]]);
}

function openPrivateKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.url("🛡️ Abrir bot de supervisión", privateBotLink())]]);
}

export async function startSupervisorBot() {
  const token = process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN;
  if (!token) {
    console.warn("Bot de supervisión desactivado: TELEGRAM_SUPERVISOR_BOT_TOKEN no está configurado.");
    return null;
  }
  if (supervisorBotStarted) return supervisorBotInstance;

  supervisorBotInstance = new Telegraf(token);
  supervisorBotInstance.start(async (context) => {
    if (isSupervisorGroup(context)) {
      await registerSupervisorGroupMember({ telegramUser: context.from, groupId: context.chat.id });
      await context.reply(
        "Tu acceso de supervisor fue habilitado. Abre el bot en privado para continuar.",
        openPrivateKeyboard()
      );
      return;
    }

    if (context.chat?.type !== "private") return;
    const access = await getSupervisorAccess(context.from.id);
    if (!access.invited) {
      await context.reply("Primero usa /start dentro del grupo de supervisores autorizado.");
      return;
    }
    await context.reply("🛡️ Abre la supervisión de inspecciones:", supervisorMiniAppKeyboard());
  });

  supervisorBotInstance.catch((error, context) => {
    console.error("Error procesando actualización del bot de supervisión:", {
      updateId: context.update?.update_id,
      message: error.message
    });
  });
  await supervisorBotInstance.telegram.setMyCommands([
    { command: "start", description: "Abrir supervisión de inspecciones" }
  ]);
  await supervisorBotInstance.launch({ dropPendingUpdates: true });
  supervisorBotStarted = true;
  console.log("Bot de supervisión iniciado correctamente.");
  return supervisorBotInstance;
}

export function stopSupervisorBot(signal) {
  if (!supervisorBotInstance) return;
  supervisorBotInstance.stop(signal);
  supervisorBotStarted = false;
}
