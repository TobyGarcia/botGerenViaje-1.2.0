import { Markup, Telegraf } from "telegraf";
import {
  getSupervisorAccess,
  registerSupervisorGroupMember
} from "../services/supervisor-telegram.service.js";

let supervisorBotInstance = null;
let supervisorBotStarted = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reintenta el arranque del bot si Telegram responde con 409 (conflicto por
// una instancia previa que aún no terminó de apagarse durante un deploy).
async function launchWithRetry(bot, { maxAttempts = 10, baseDelayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch({ dropPendingUpdates: true });
      return true;
    } catch (error) {
      const isConflict =
        error?.response?.error_code === 409 ||
        /409/.test(error?.message || "");

      if (!isConflict || attempt === maxAttempts) {
        console.error(
          `No fue posible iniciar el polling del bot de supervisores tras ${attempt} intento(s):`,
          error.message
        );
        return false;
      }

      // Durante un despliegue, Telegram puede conservar el long polling del
      // proceso anterior hasta por varios segundos. Reintentar más tiempo evita
      // que el bot quede deshabilitado cuando Render reemplaza la instancia.
      const waitMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), 30000);
      console.warn(
        `Conflicto 409 al iniciar el bot de supervisores (intento ${attempt}/${maxAttempts}). Reintentando en ${waitMs / 1000}s...`
      );
      await delay(waitMs);
    }
  }

  return false;
}

// Limpia IDs de Telegram para evitar fallos por signos negativos o prefijos de supergrupo (100)
function cleanGroupId(id) {
  if (!id) return "";
  return String(id).replace(/^-/, "").replace(/^100/, "");
}

function isSupervisorGroup(context) {
  const groupId = process.env.TELEGRAM_GROUP_SUPRVISOR_ID || process.env.TELEGRAM_GROUP_SUPERVISOR_ID;
  if (!groupId || !context.chat?.id) return false;

  const isGroup = ["group", "supergroup"].includes(context.chat?.type);
  const cleanContextId = cleanGroupId(context.chat.id);
  const cleanEnvId = cleanGroupId(groupId);

  console.log("Evaluando si es grupo de supervisores:", {
    chatType: context.chat?.type,
    chatId: context.chat?.id,
    cleanChatId: cleanContextId,
    envGroupId: groupId,
    cleanEnvGroupId: cleanEnvId,
    isGroup,
    matches: cleanContextId === cleanEnvId
  });

  return isGroup && cleanContextId === cleanEnvId;
}

function privateBotLink(context) {
  const username = context.botInfo?.username || process.env.TELEGRAM_SUPERVISOR_BOT_USERNAME?.replace(/^@/, "");
  if (!username) throw new Error("No se pudo obtener el username del bot de supervisión.");
  return `https://t.me/${username}?start=supervisor`;
}

function supervisorMiniAppKeyboard() {
  const url = process.env.TELEGRAM_SUPERVISOR_WEB_APP_URL;
  if (!url) throw new Error("TELEGRAM_SUPERVISOR_WEB_APP_URL no está configurada.");
  return Markup.inlineKeyboard([[Markup.button.webApp("🛡️ Abrir supervisión", url)]]);
}

function openPrivateKeyboard(context) {
  return Markup.inlineKeyboard([[Markup.button.url("🛡️ Abrir bot de supervisión", privateBotLink(context))]]);
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
    console.log("Comando /start recibido en supervisor bot:", {
      chatId: context.chat?.id,
      chatType: context.chat?.type,
      fromId: context.from?.id,
      fromUsername: context.from?.username
    });

    try {
      if (isSupervisorGroup(context)) {
        await registerSupervisorGroupMember({ telegramUser: context.from, groupId: context.chat.id });
        await context.reply(
          "Tu acceso de supervisor fue habilitado. Abre el bot en privado para continuar.",
          openPrivateKeyboard(context)
        );
        return;
      }

      if (context.chat?.type !== "private") {
        console.log("Comando /start ignorado: no es un grupo autorizado ni un chat privado.");
        return;
      }

      const access = await getSupervisorAccess(context.from.id);
      if (!access.invited) {
        await context.reply("Primero usa /start dentro del grupo de supervisores autorizado.");
        return;
      }
      await context.reply("🛡️ Abre la supervisión de inspecciones:", supervisorMiniAppKeyboard());
    } catch (error) {
      console.error("Error procesando /start de supervisores:", error);
    }
  });

  supervisorBotInstance.command("ayuda", async (context) => {
    if (context.chat?.type !== "private") return;
    await context.reply("Comandos disponibles:\n\n/start - Abrir supervisión de inspecciones\n/ayuda - Mostrar esta ayuda");
  });

  supervisorBotInstance.on("message", async (context) => {
    if (context.chat?.type !== "private") return;
    await context.reply("No reconozco ese comando. Usa /start para abrir la Mini App de supervisión o /ayuda.");
  });

  supervisorBotInstance.catch((error, context) => {
    console.error("Error procesando actualización del bot de supervisión:", {
      updateId: context.update?.update_id,
      message: error.message
    });
  });

  await supervisorBotInstance.telegram.setMyCommands([
    { command: "start", description: "Abrir supervisión de inspecciones" },
    { command: "ayuda", description: "Mostrar ayuda" }
  ]);

  const started = await launchWithRetry(supervisorBotInstance);

  if (started) {
    supervisorBotStarted = true;
    console.log("Bot de supervisión iniciado correctamente.");
  }

  return supervisorBotInstance;
}

export function stopSupervisorBot(signal) {
  if (!supervisorBotInstance) return;
  supervisorBotInstance.stop(signal);
  supervisorBotStarted = false;
}

// Envía una alerta al grupo de supervisores cuando un conductor sube una
// inspección vehicular nueva que queda pendiente de aprobación.
export async function notifyNewInspectionRequest({
  idInspeccion,
  folio,
  conductor,
  vehiculo,
  danos,
  esDiaSiguiente,
  fechaOperativa
} = {}) {
  const groupId = process.env.TELEGRAM_GROUP_SUPRVISOR_ID || process.env.TELEGRAM_GROUP_SUPERVISOR_ID;

  if (!groupId) {
    console.warn("No se envió la alerta de inspección: TELEGRAM_GROUP_SUPRVISOR_ID no está configurado.");
    return;
  }

  if (!supervisorBotInstance) {
    console.warn("No se envió la alerta de inspección: el bot de supervisión no está inicializado.");
    return;
  }

  // Enviar mensajes no requiere que el polling haya arrancado. Esto permite
  // notificar al grupo incluso mientras se resuelve un 409 de getUpdates.
  if (!supervisorBotStarted) {
    console.warn("El polling del bot de supervisión aún no está activo; se intentará enviar la alerta al grupo de todos modos.");
  }

  const message = [
    "🛎️ Nueva inspección pendiente de aprobación",
    esDiaSiguiente ? `🌙 Programación: Inspección para el Día Siguiente (${fechaOperativa || "Mañana"})` : null,
    `Folio: ${folio ?? "No disponible"}`,
    `Conductor: ${conductor ?? "No disponible"}`,
    `Unidad: ${vehiculo ?? "No disponible"}`,
    `Daños marcados: ${Object.entries(danos || {}).map(([vista, puntos]) => `${vista}: ${Array.isArray(puntos) ? puntos.length : 0}`).filter(([, total]) => total > 0).map(([vista, total]) => `${vista} (${total})`).join(", ") || "Sin daños marcados"}`,
    idInspeccion ? `ID inspección: ${idInspeccion}` : null,
    "Abre la Mini App de supervisión para revisarla."
  ].filter(Boolean).join("\n");

  try {
    await supervisorBotInstance.telegram.sendMessage(groupId, message);
  } catch (error) {
    console.error("No fue posible enviar la alerta de inspección al grupo de supervisores:", error);
  }
}
