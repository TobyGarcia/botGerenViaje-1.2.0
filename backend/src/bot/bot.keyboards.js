import { Markup } from "telegraf";

import {
  getPrivateBotLink
} from "./bot.helpers.js";

export function getMiniAppKeyboard() {
  const webAppUrl =
    process.env.TELEGRAM_WEB_APP_URL;

  if (!webAppUrl) {
    throw new Error(
      "La variable TELEGRAM_WEB_APP_URL no está configurada."
    );
  }

  return Markup.inlineKeyboard([
    [
      Markup.button.webApp(
        "🚗 Abrir gerenciamiento de viajes",
        webAppUrl
      )
    ]
  ]);
}

export function getSupervisorMiniAppKeyboard() {
  const webAppUrl = process.env.TELEGRAM_SUPERVISOR_WEB_APP_URL || process.env.TELEGRAM_WEB_APP_URL;
  if (!webAppUrl) throw new Error("La URL de la Mini App para supervisores no está configurada.");
  return Markup.inlineKeyboard([[Markup.button.webApp("🛡️ Abrir supervisión de inspecciones", webAppUrl)]]);
}

export function getPrivateSupervisorKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "🛡️ Abrir supervisión en privado",
        getPrivateBotLink("supervisor")
      )
    ]
  ]);
}

export function getPrivateRegistrationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "🔐 Completar registro",
        getPrivateBotLink("registro")
      )
    ]
  ]);
}

export function getPrivateTripKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "🚗 Abrir en privado",
        getPrivateBotLink("viaje")
      )
    ]
  ]);
}
