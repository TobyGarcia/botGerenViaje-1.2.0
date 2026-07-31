import { Telegraf } from "telegraf";

import {
  registerBotHandlers
} from "./bot.handlers.js";

let botInstance = null;
let botStarted = false;

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
    { command: "ayuda", description: "Mostrar ayuda" }
  ]);

  await bot.launch({
    dropPendingUpdates: true
  });

  botStarted = true;

  console.log(
    "Bot de Telegram iniciado correctamente."
  );

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
