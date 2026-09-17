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
  getPrivateTripKeyboard
} from "./bot.keyboards.js";

import { getSupervisorAccess } from "../services/supervisor-telegram.service.js";
import {
  getSupervisorAssignedVehicleTurnStatus,
  finalizeSupervisorShift,
  startSupervisorShift
} from "../services/turnos-vehiculo.service.js";

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
  bot.command("turno", async (context) => {
    logCommand(context, "turno");
    try {
      const access = await getSupervisorAccess(context.from.id);
      if (!access?.user?.id_usuarios_admin) {
        await context.reply("⚠️ Tu cuenta de Telegram no está vinculada a un usuario supervisor registrado.");
        return;
      }

      const status = await getSupervisorAssignedVehicleTurnStatus(access.user.id_usuarios_admin);
      if (!status.assigned || !status.vehiculo) {
        await context.reply("ℹ️ No tienes un vehículo asignado como supervisor a cargo en este momento.");
        return;
      }

      const v = status.vehiculo;
      const turn = status.turnoActivo;

      if (turn && turn.estado === "EN_TRASLADO_CASA") {
        await context.reply(
          [
            `🚗 *Unidad Asignada:* ${v.nombre} (${v.numero_economico})`,
            `📌 *Placas:* ${v.placas || "N/A"}`,
            `📍 *Estado Actual:* 🏠 EN TRASLADO A DOMICILIO (Fuera de turno)`,
            `⏱️ *Odómetro de Salida:* ${turn.odometro_final_turno} km`,
            "",
            "🏢 *Para regresar a base e iniciar turno:*",
            "Responde con: `/inicio_turno [odometro_inicial]`",
            "Ejemplo: `/inicio_turno ${turn.odometro_final_turno + 20}`",
            "",
            "O bien abre la Mini App desde el menú *bot de viaje*."
          ].join("\n"),
          { parse_mode: "Markdown", ...getMiniAppKeyboard() }
        );
      } else {
        await context.reply(
          [
            `🚗 *Unidad Asignada:* ${v.nombre} (${v.numero_economico})`,
            `📌 *Placas:* ${v.placas || "N/A"}`,
            `📍 *Estado Actual:* 🏢 EN BASE / EN TURNO`,
            `⏱️ *Kilometraje Actual:* ${v.kilometraje_actual} km`,
            "",
            "🏠 *Para finalizar turno y llevar unidad a casa:*",
            "Responde con: `/fin_turno [odometro_final]`",
            "Ejemplo: `/fin_turno ${v.kilometraje_actual}`",
            "",
            "O bien abre la Mini App desde el menú *bot de viaje*."
          ].join("\n"),
          { parse_mode: "Markdown", ...getMiniAppKeyboard() }
        );
      }
    } catch (err) {
      console.error("Error en comando /turno:", err);
      await context.reply("❌ Error al consultar el estado de turno de tu unidad.");
    }
  });

  bot.command("fin_turno", async (context) => {
    logCommand(context, "fin_turno");
    try {
      const access = await getSupervisorAccess(context.from.id);
      if (!access?.user?.id_usuarios_admin) {
        await context.reply("⚠️ No tienes permisos de supervisor o cuenta vinculada.");
        return;
      }

      const status = await getSupervisorAssignedVehicleTurnStatus(access.user.id_usuarios_admin);
      if (!status.assigned || !status.vehiculo) {
        await context.reply("ℹ️ No tienes una unidad asignada a tu cargo.");
        return;
      }

      const args = context.message.text.split(" ").slice(1).join(" ").trim();
      const odometroFinal = Number(args);

      if (!args || !Number.isInteger(odometroFinal) || odometroFinal < 0) {
        await context.reply(
          `⚠️ Indica el odómetro final al salir de base.\nEjemplo: \`/fin_turno ${status.vehiculo.kilometraje_actual}\``,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const res = await finalizeSupervisorShift({
        idVehiculo: status.vehiculo.id_vehiculos,
        idUsuarioAdmin: access.user.id_usuarios_admin,
        odometroFinal
      });

      await context.reply(
        [
          "✅ *Turno Finalizado Correctamente*",
          `🚗 *Vehículo:* ${status.vehiculo.nombre} (${status.vehiculo.numero_economico})`,
          `⏱️ *Odómetro Final:* ${res.vehiculo.kilometraje_actual} km`,
          "🏠 La unidad queda asentada en *traslado a domicilio*."
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      await context.reply(`❌ ${err.message || "Error al finalizar turno."}`);
    }
  });

  bot.command("inicio_turno", async (context) => {
    logCommand(context, "inicio_turno");
    try {
      const access = await getSupervisorAccess(context.from.id);
      if (!access?.user?.id_usuarios_admin) {
        await context.reply("⚠️ No tienes permisos de supervisor o cuenta vinculada.");
        return;
      }

      const status = await getSupervisorAssignedVehicleTurnStatus(access.user.id_usuarios_admin);
      if (!status.assigned || !status.vehiculo) {
        await context.reply("ℹ️ No tienes una unidad asignada a tu cargo.");
        return;
      }

      const args = context.message.text.split(" ").slice(1).join(" ").trim();
      const odometroInicial = Number(args);

      if (!args || !Number.isInteger(odometroInicial) || odometroInicial < 0) {
        await context.reply(
          "⚠️ Indica el odómetro inicial al regresar a base.\nEjemplo: `/inicio_turno 15230`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const res = await startSupervisorShift({
        idVehiculo: status.vehiculo.id_vehiculos,
        idUsuarioAdmin: access.user.id_usuarios_admin,
        odometroInicial
      });

      await context.reply(
        [
          "✅ *Inicio de Turno Registrado*",
          `🚗 *Vehículo:* ${status.vehiculo.nombre} (${status.vehiculo.numero_economico})`,
          `⏱️ *Odómetro Llegada:* ${res.vehiculo.kilometraje_actual} km`,
          `📊 *Km Recorridos Traslado Casa:* ${res.kmRecorridosCasa} km`,
          "🏢 La unidad regresa a estado *En Base / En Turno*."
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      await context.reply(`❌ ${err.message || "Error al iniciar turno."}`);
    }
  });

  bot.start(async (context) => {

    const startParameter =
      context.message?.text
        ?.split(" ")
        ?.slice(1)
        ?.join(" ")
        ?.trim() || "";

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

  bot.command("gerenciamiento", async (context) => {
    logCommand(context, "gerenciamiento");

    try {
      if (isPrivateChat(context)) {
        const telegramUser = await findTelegramUserById(context.from.id);
        if (!isRegisteredDriver(telegramUser)) {
          await context.reply(
            "🔐 Debes completar tu registro antes de realizar un gerenciamiento de viaje.",
            getMiniAppKeyboard()
          );
          return;
        }

        await context.reply(
          "🗺️ Abre el formato de Gerenciamiento de Viajes (Fuera de la Ciudad/Estado):",
          getMiniAppKeyboard()
        );
        return;
      }

      if (!isAuthorizedGroup(context)) return;

      await context.reply(
        "Abre el bot en privado para registrar el gerenciamiento de viaje.",
        getPrivateTripKeyboard()
      );
    } catch (error) {
      console.error("Error en comando gerenciamiento:", error);
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
        "/gerenciamiento - Formato de viajes fuera de la ciudad o estado",
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
