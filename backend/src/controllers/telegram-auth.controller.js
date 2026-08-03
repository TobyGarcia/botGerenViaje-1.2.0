import {
  findOrCreateTelegramUser,
  registerTelegramDriver,
  TelegramRegistrationError
} from "../services/telegram-auth.service.js";

import {
  validateTelegramInitData
} from "../utils/telegram-init-data.js";

export async function authenticateTelegramController(
  request,
  response
) {
  try {
    const initData =
      request.body?.initData;

    const telegramData =
      validateTelegramInitData(
        initData,
        {
          botToken:
            process.env
              .TELEGRAM_BOT_TOKEN,

          maxAgeSeconds:
            Number(
              process.env
                .TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ||
              3600
            )
        }
      );

    const result =
      await findOrCreateTelegramUser({
        telegramUser:
          telegramData.user
      });

    const registered =
      result.telegramUser
        .estado_registro ===
        "COMPLETO" &&
      Boolean(
        result.telegramUser
          .id_conductores
      );

    return response
      .status(200)
      .json({
        success: true,

        data: {
          authenticated: true,
          registered,

          estadoRegistro:
            result.telegramUser
              .estado_registro,

          usuario: {
            idUsuarioTelegram:
              result.telegramUser
                .id_usuario_telegram,

            telegramUserId:
              String(
                result.telegramUser
                  .telegram_user_id
              ),

            username:
              result.telegramUser
                .telegram_username,

            firstName:
              result.telegramUser
                .telegram_first_name,

            lastName:
              result.telegramUser
                .telegram_last_name,

            rol:
              result.telegramUser.rol,

            activo:
              result.telegramUser.activo
          },

          conductor:
            result.conductor
        }
      });
  } catch (error) {
    console.error(
      "Error autenticando Telegram:",
      error
    );

    const authenticationErrors = [
      "initData",
      "firma",
      "auth_date",
      "sesión",
      "usuario"
    ];

    const isAuthenticationError =
      authenticationErrors.some(
        (text) =>
          error.message
            .toLowerCase()
            .includes(
              text.toLowerCase()
            )
      );

    return response
      .status(
        isAuthenticationError
          ? 401
          : 500
      )
      .json({
        success: false,

        message:
          error.message ||
          "No fue posible autenticar al usuario de Telegram."
      });
  }
}

function validateDriverRegistration(body) {
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const telefono = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const licenciaNumero = typeof body?.licenciaNumero === "string"
    ? body.licenciaNumero.trim()
    : "";
  const licenciaVencimiento = typeof body?.licenciaVencimiento === "string"
    ? body.licenciaVencimiento.trim()
    : "";
  const tipoLicencia = typeof body?.tipoLicencia === "string" ? body.tipoLicencia.trim() : "";

  if (!nombre || nombre.length > 150) {
    throw new TelegramRegistrationError("El nombre es obligatorio y no puede exceder 150 caracteres.", 400);
  }

  if (!telefono || telefono.length > 30) {
    throw new TelegramRegistrationError("El teléfono es obligatorio y no puede exceder 30 caracteres.", 400);
  }

  if (!licenciaNumero || licenciaNumero.length > 50) {
    throw new TelegramRegistrationError("El número de licencia es obligatorio y no puede exceder 50 caracteres.", 400);
  }
  if (!tipoLicencia || tipoLicencia.length > 50) {
    throw new TelegramRegistrationError("El tipo de licencia es obligatorio y no puede exceder 50 caracteres.", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(licenciaVencimiento)) {
    throw new TelegramRegistrationError("La fecha de vencimiento debe tener el formato AAAA-MM-DD.", 400);
  }

  const parsedDate = new Date(`${licenciaVencimiento}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== licenciaVencimiento) {
    throw new TelegramRegistrationError("La fecha de vencimiento no es válida.", 400);
  }

  return { nombre, telefono, licenciaNumero, tipoLicencia, licenciaVencimiento };
}

export async function registerTelegramDriverController(request, response) {
  try {
    const telegramData = validateTelegramInitData(request.body?.initData, {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
    });
    const driverData = validateDriverRegistration(request.body);
    const result = await registerTelegramDriver({
      telegramUserId: telegramData.user.id,
      ...driverData
    });

    return response.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        authenticated: true,
        registered: true,
        estadoRegistro: "COMPLETO",
        usuario: {
          firstName: result.telegramUser.telegram_first_name,
          lastName: result.telegramUser.telegram_last_name,
          rol: result.telegramUser.rol
        },
        conductor: result.conductor
      }
    });
  } catch (error) {
    const statusCode = error instanceof TelegramRegistrationError
      ? error.statusCode
      : ["initData", "firma", "auth_date", "sesión", "usuario"].some((text) =>
        error.message?.toLowerCase().includes(text.toLowerCase())
      )
        ? 401
        : 500;

    if (statusCode === 500) {
      console.error("Error registrando conductor de Telegram:", error.message);
    }

    return response.status(statusCode).json({
      success: false,
      message: statusCode === 500
        ? "No fue posible registrar al conductor."
        : error.message
    });
  }
}
