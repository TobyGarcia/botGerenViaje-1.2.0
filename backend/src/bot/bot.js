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
