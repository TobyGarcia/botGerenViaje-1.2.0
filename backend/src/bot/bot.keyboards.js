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
