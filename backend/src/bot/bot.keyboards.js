import { Markup } from "telegraf";

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