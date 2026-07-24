import {
  getMiniAppKeyboard
} from "./bot.keyboards.js";

export function registerBotHandlers(bot) {
  bot.start(async (context) => {
    const userName =
      context.from?.first_name ||
      context.from?.username ||
      "usuario";

    await context.reply(
      [
        `Hola, ${userName}.`,
        "",
        "Desde esta Mini App puedes:",
        "• registrar un viaje;",
        "• iniciar el recorrido;",
        "• compartir ubicación GPS;",
        "• finalizar el viaje."
      ].join("\n"),
      getMiniAppKeyboard()
    );
  });

  bot.command("viaje", async (context) => {
    await context.reply(
      "Abre el sistema de gerenciamiento de viajes:",
      getMiniAppKeyboard()
    );
  });

  bot.command("ayuda", async (context) => {
    await context.reply(
      [
        "Comandos disponibles:",
        "",
        "/start - Mostrar el menú principal",
        "/viaje - Abrir la Mini App",
        "/ayuda - Mostrar esta ayuda"
      ].join("\n")
    );
  });

  bot.catch((error, context) => {
    console.error(
      "Error procesando una actualización de Telegram:",
      {
        updateId: context.update?.update_id,
        error
      }
    );
  });
}