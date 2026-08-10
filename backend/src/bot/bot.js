import { Telegraf } from "telegraf";

import {
  registerBotHandlers
} from "./bot.handlers.js";

let botInstance = null;
let botStarted = false;

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
          `No fue posible iniciar el bot de Telegram tras ${attempt} intento(s):`,
          error.message
        );
        return false;
      }

      const waitMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), 30000);
      console.warn(
        `Conflicto 409 al iniciar el bot de Telegram (intento ${attempt}/${maxAttempts}). Reintentando en ${waitMs / 1000}s...`
      );
      await delay(waitMs);
    }
  }

  return false;
}

export function getTelegramBot() {
  if (botInstance) {
    return botInstance;
  }

  const token =
    process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN no está configurado."
    );
  }

  botInstance = new Telegraf(token);

  registerBotHandlers(botInstance);

  return botInstance;
}

export async function startTelegramBot() {
  const bot = getTelegramBot();

  if (botStarted) {
    return bot;
  }

  console.log(
    "Iniciando conexión con Telegram..."
  );

  await bot.telegram.setMyCommands([
    { command: "viaje", description: "Abrir el sistema de viajes" },
    { command: "registro", description: "Completar registro como conductor" },
    { command: "start", description: "Iniciar registro o abrir el sistema" },
    { command: "ayuda", description: "Mostrar ayuda" }
  ]);

  const started = await launchWithRetry(bot);

  if (started) {
    botStarted = true;
    console.log(
      "Bot de Telegram iniciado correctamente."
    );
  }

  return bot;
}

export async function stopTelegramBot(signal) {
  if (!botInstance) {
    return;
  }

  botInstance.stop(signal);
  botStarted = false;

  console.log(
    `Bot de Telegram detenido por ${signal}.`
  );
}

export async function sendTripGroupAlert({
  action,
  trip
}) {
  const groupId = process.env.TELEGRAM_GROUP_ID;

  if (!groupId) {
    console.warn(
      "No se envió la alerta del viaje: TELEGRAM_GROUP_ID no está configurado."
    );
    return;
  }

  const formatTime = (value) => value
    ? new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value))
    : "No registrada";

  const companions = Array.isArray(trip.acompanantes)
    ? trip.acompanantes
      .map((companion) => companion?.nombre)
      .filter(Boolean)
      .join(", ")
    : "";

  const baseDetails = [
    `Folio: ${trip.folio ?? "No disponible"}`,
    `Conductor: ${trip.conductor ?? "No disponible"}`,
    `Unidad: ${trip.vehiculo ?? "No disponible"}`,
    trip.numeroEconomico
      ? `Número económico: ${trip.numeroEconomico}`
      : null
  ];

  const messages = {
    iniciado: [
      "🚐 Viaje INICIADO",
      ...baseDetails,
      `Licencia vigente: ${trip.licenciaVigente ? "Sí" : "No"}`,
      `Kilometraje inicial: ${trip.kilometrajeInicial ?? "No registrado"} km`,
      `Origen: ${trip.origen ?? "No registrado"}`,
      `Destino: ${trip.destino ?? "No registrado"}`,
      `Acompañantes: ${companions || "Sin acompañantes"}`,
      `Motivo: ${trip.motivo ?? "No registrado"}`,
      `Hora de salida: ${formatTime(trip.horaSalida)}`
    ],
    finalizado: [
      "🚐 Viaje FINALIZADO",
      ...baseDetails,
      `Hora de finalización: ${formatTime(trip.horaLlegada)}`
    ],
    cancelado: [
      "🚐 Viaje CANCELADO",
      ...baseDetails
    ]
  };

  const message = (messages[action] ?? [
    `🚐 Viaje ${action.toUpperCase()}`,
    ...baseDetails
  ])
    .filter(Boolean)
    .join("\n");

  try {
    await getTelegramBot().telegram.sendMessage(groupId, message);
  } catch (error) {
    console.error("No fue posible enviar la alerta al grupo:", error);
  }
}

export async function sendDriverInspectionNotification({
  telegramUserId,
  approved,
  trip,
  comment
}) {
  if (!telegramUserId) return;

  const reason = String(comment || "").trim();
  const message = approved
    ? [
      "✅ Inspección vehicular aprobada",
      `Folio: ${trip?.folio ?? "No disponible"}`,
      `Unidad: ${trip?.vehiculo ?? "No disponible"}`,
      "Ya puedes abrir la Mini App e iniciar el viaje cuando estés listo."
    ]
    : [
      "❌ Inspección vehicular rechazada",
      `Folio: ${trip?.folio ?? "No disponible"}`,
      "El viaje fue cancelado automáticamente.",
      `Motivo: ${reason || "No se proporcionó un comentario administrativo."}`
    ];

  try {
    await getTelegramBot().telegram.sendMessage(
      String(telegramUserId),
      message.join("\n")
    );
  } catch (error) {
    console.error("No fue posible notificar la decisión de inspección al conductor:", error);
  }
}
