import {
  findTelegramUserById
} from "../services/telegram-user.service.js";

import {
  isAuthorizedGroup,
  isPrivateChat,
  logCommand
} from "./bot.helpers.js";

import {
  getMiniAppKeyboard,
  getPrivateRegistrationKeyboard,
  getPrivateTripKeyboard,
  getSupervisorMiniAppKeyboard
} from "./bot.keyboards.js";
import { registerSupervisorGroupMember } from "../services/supervisor-telegram.service.js";

function isRegisteredDriver(user) {
  return Boolean(
    user &&
    user.activo === true &&
    user.estado_registro === "COMPLETO" &&
    user.id_conductores &&
    user.conductor_activo !== false
  );
}

export function registerBotHandlers(bot) {
  bot.start(async (context) => {
    const startParameter =
      context.message?.text
        ?.split(" ")
        ?.slice(1)
        ?.join(" ")
        ?.trim() || "";

    const supervisorGroupId = process.env.TELEGRAM_GROUP_SUPRVISOR_ID;
    const isSupervisorGroup = supervisorGroupId && String(context.chat?.id) === String(supervisorGroupId) && ["group", "supergroup"].includes(context.chat?.type);
    if (isSupervisorGroup) {
      await registerSupervisorGroupMember({ telegramUser: context.from, groupId: context.chat.id });
      await context.reply([
        `Bienvenido/a ${context.from.first_name || "supervisor/a"}.`,
        "Regístrate desde la Mini App para revisar y aprobar inspecciones.",
        "El usuario debe tener de 3 a 100 caracteres y puede usar letras, números, punto, guion y guion bajo.",
        "Durante las pruebas solo se acepta correo @itzamna.mx."
      ].join("\n"), getSupervisorMiniAppKeyboard());
      return;
    }
    if (!isPrivateChat(context)) {
      return;
    }
  
    const telegramUser =
      await findTelegramUserById(
        context.from.id
      );

    if (!isRegisteredDriver(telegramUser)) {
      await context.reply(
        [
          "🔐 Debes completar tu registro.",
          "",
          "Abre la Mini App para registrarte como conductor."
        ].join("\n"),
        getMiniAppKeyboard()
      );

      return;
    }

    const message =
      startParameter === "registro"
        ? "Tu registro ya está completo."
        : "Ya puedes abrir el sistema de viajes.";

    await context.reply(
      message,
      getMiniAppKeyboard()
    );
  });

  bot.command("viaje", async (context) => {
    logCommand(context, "viaje");

    try {
      if (isPrivateChat(context)) {
      const telegramUser =
        await findTelegramUserById(
          context.from.id
        );

      if (!isRegisteredDriver(telegramUser)) {
        await context.reply(
          [
            "🔐 Aún no estás registrado.",
            "",
            "Completa primero tu registro como conductor."
          ].join("\n"),
          getMiniAppKeyboard()
        );

        return;
      }

      await context.reply(
        "🚗 Abre el sistema de viajes:",
        getMiniAppKeyboard()
      );

        return;
      }

      if (!isAuthorizedGroup(context)) {
        return;
      }

      const telegramUser =
        await findTelegramUserById(
          context.from.id
        );

      if (!isRegisteredDriver(telegramUser)) {
        await context.reply(
        [
          `🔒 ${context.from.first_name || "Usuario"},`,
          "debes completar tu registro antes de iniciar un viaje.",
          "",
          "El registro se realiza en privado con el bot."
        ].join("\n"),
        getPrivateRegistrationKeyboard()
      );

        return;
      }

      await context.reply(
      [
        `✅ ${telegramUser.conductor_nombre},`,
        "tu usuario está autorizado.",
        "",
        "Abre el bot en privado para registrar el viaje."
      ].join("\n"),
        getPrivateTripKeyboard()
      );
    } catch (error) {
      console.error("Error procesando comando Telegram:", {
        command: "viaje",
        chatId: context.chat?.id,
        chatType: context.chat?.type,
        authorizedGroup: isAuthorizedGroup(context),
        updateId: context.update?.update_id,
        message: error.message
      });
    }
  });

  bot.command("registro", async (context) => {
    logCommand(context, "registro");

    try {
      if (!isPrivateChat(context)) {
      if (!isAuthorizedGroup(context)) {
        return;
      }

      await context.reply(
        "El registro se realiza en privado.",
        getPrivateRegistrationKeyboard()
      );

        return;
      }

      await context.reply(
        "Abre la Mini App para completar tu registro:",
        getMiniAppKeyboard()
      );
    } catch (error) {
      console.error("Error procesando comando Telegram:", {
        command: "registro",
        chatId: context.chat?.id,
        chatType: context.chat?.type,
        authorizedGroup: isAuthorizedGroup(context),
        updateId: context.update?.update_id,
        message: error.message
      });
    }
  });

  bot.command("ayuda", async (context) => {
    logCommand(context, "ayuda");

    try {
      if (
      !isPrivateChat(context) &&
      !isAuthorizedGroup(context)
    ) {
        return;
      }

      await context.reply(
      [
        "Comandos disponibles:",
        "",
        "/viaje - Abrir el sistema de viajes",
        "/registro - Completar registro",
        "/ayuda - Mostrar ayuda"
        ].join("\n")
      );
    } catch (error) {
      console.error("Error procesando comando Telegram:", {
        command: "ayuda",
        chatId: context.chat?.id,
        chatType: context.chat?.type,
        authorizedGroup: isAuthorizedGroup(context),
        updateId: context.update?.update_id,
        message: error.message
      });
    }
  });

  bot.catch((error, context) => {
    console.error(
      "Error procesando actualización Telegram:",
      {
        updateId:
          context.update?.update_id,

        message:
          error.message
      }
    );
  });
}
