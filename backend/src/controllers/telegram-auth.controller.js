import {
  findOrCreateTelegramUser,
  registerTelegramDriver,
  TelegramRegistrationError
} from "../services/telegram-auth.service.js";

import {
  validateTelegramInitData
} from "../utils/telegram-init-data.js";
import { createDriverSessionToken } from "../utils/driver-session.js";
import { sendDriverRegistrationSupervisorAlert } from "../bot/bot.js";
import { saveLicenseFileBase64 } from "../utils/file-storage.js";


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

    const token = result.conductor ? createDriverSessionToken(result.conductor) : null;

    return response
      .status(200)
      .json({
        success: true,

        data: {
          authenticated: true,
          registered,
          token,

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
  const empresa = typeof body?.empresa === "string" ? body.empresa.trim().toUpperCase() : "";

  const fechaManejoComentado = typeof body?.fechaManejoComentado === "string" && body.fechaManejoComentado.trim()
    ? body.fechaManejoComentado.trim()
    : null;

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
  if (!["ITZAMNA", "MCCLICK", "AQUARIO", "ASPROMEX", "BALAM", "AGROKOOL"].includes(empresa)) throw new TelegramRegistrationError("Selecciona una empresa válida.", 400);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(licenciaVencimiento)) {
    throw new TelegramRegistrationError("La fecha de vencimiento debe tener el formato AAAA-MM-DD.", 400);
  }

  const parsedDate = new Date(`${licenciaVencimiento}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== licenciaVencimiento) {
    throw new TelegramRegistrationError("La fecha de vencimiento no es válida.", 400);
  }

  if (fechaManejoComentado) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaManejoComentado)) {
      throw new TelegramRegistrationError("La fecha de manejo comentado debe tener el formato AAAA-MM-DD.", 400);
    }
    const parsedMC = new Date(`${fechaManejoComentado}T00:00:00Z`);
    if (Number.isNaN(parsedMC.getTime()) || parsedMC.toISOString().slice(0, 10) !== fechaManejoComentado) {
      throw new TelegramRegistrationError("La fecha de manejo comentado no es válida.", 400);
    }
  }

  let licenciaUrl = typeof body?.licenciaUrl === "string" ? body.licenciaUrl.trim() : null;
  if (typeof body?.licenciaArchivoBase64 === "string" && body.licenciaArchivoBase64.trim()) {
    licenciaUrl = saveLicenseFileBase64(body.licenciaArchivoBase64, body.licenciaNombreArchivo || "", "licencia_frente");
  }

  let licenciaReversoUrl = typeof body?.licenciaReversoUrl === "string" ? body.licenciaReversoUrl.trim() : null;
  if (typeof body?.licenciaReversoBase64 === "string" && body.licenciaReversoBase64.trim()) {
    licenciaReversoUrl = saveLicenseFileBase64(body.licenciaReversoBase64, body.licenciaReversoNombre || "", "licencia_reverso");
  }

  return { nombre, telefono, licenciaNumero, tipoLicencia, empresa, licenciaVencimiento, fechaManejoComentado, licenciaUrl, licenciaReversoUrl };
}


export async function registerTelegramDriverController(request, response) {
  try {
    let telegramUserId = null;
    if (request.body?.initData) {
      try {
        const telegramData = validateTelegramInitData(request.body.initData, {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
        });
        telegramUserId = telegramData?.user?.id || null;
      } catch (e) {
        console.warn("initData enviado no verificado (registro vía navegador):", e.message);
      }
    }

    const driverData = validateDriverRegistration(request.body);
    const result = await registerTelegramDriver({
      telegramUserId,
      ...driverData
    });

    if (result.created && result.conductor) {
      // Subir fotos de la licencia a SharePoint en la carpeta "Licencias"
      (async () => {
        try {
          const { uploadDriverLicenseToSharePoint } = await import("../services/sharepoint.service.js");
          const { databasePool } = await import("../database/pool.js");

          function parseBase64(base64Str) {
            if (!base64Str || typeof base64Str !== "string") return null;
            const match = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!match) return null;
            return {
              mimeType: match[1],
              buffer: Buffer.from(match[2], "base64"),
              extension: match[1].includes("pdf") ? "pdf" : match[1].includes("png") ? "png" : "jpg"
            };
          }

          let spFrenteUrl = null;
          let spReversoUrl = null;

          if (request.body?.licenciaArchivoBase64) {
            const parsed = parseBase64(request.body.licenciaArchivoBase64);
            if (parsed) {
              const resSp = await uploadDriverLicenseToSharePoint({
                driverName: result.conductor.nombre,
                fileBuffer: parsed.buffer,
                mimeType: parsed.mimeType,
                side: "frente",
                extension: parsed.extension
              });
              if (resSp.success && resSp.webUrl) spFrenteUrl = resSp.webUrl;
            }
          }

          if (request.body?.licenciaReversoBase64) {
            const parsed = parseBase64(request.body.licenciaReversoBase64);
            if (parsed) {
              const resSp = await uploadDriverLicenseToSharePoint({
                driverName: result.conductor.nombre,
                fileBuffer: parsed.buffer,
                mimeType: parsed.mimeType,
                side: "reverso",
                extension: parsed.extension
              });
              if (resSp.success && resSp.webUrl) spReversoUrl = resSp.webUrl;
            }
          }

          if (spFrenteUrl || spReversoUrl) {
            await databasePool.query(
              `UPDATE conductores
               SET licencia_url = COALESCE($1, licencia_url),
                   licencia_reverso_url = COALESCE($2, licencia_reverso_url)
               WHERE id_conductores = $3`,
              [spFrenteUrl, spReversoUrl, result.conductor.id_conductores]
            );
            console.log(`[SharePoint] Licencias asociadas al conductor ${result.conductor.nombre} en la base de datos.`);
          }
        } catch (err) {
          console.warn("[SharePoint] Error al procesar subida de licencias a SharePoint:", err.message);
        }
      })();

      sendDriverRegistrationSupervisorAlert({ conductor: result.conductor, pinGenerado: result.pinGenerado }).catch((err) => {
        console.warn("Fallo al enviar alerta de registro a supervisores:", err.message);
      });
    }

    return response.status(result.created ? 201 : 200).json({
      success: true,
      message: "Registro recibido con éxito. Tu cuenta se encuentra en espera de aprobación.",
      data: {
        authenticated: true,
        registered: Boolean(result.conductor?.aprobado_por_admin),
        estadoRegistro: result.telegramUser?.estado_registro || "PENDIENTE_APROBACION",
        pinGenerado: result.pinGenerado || null,
        aprobado: Boolean(result.conductor?.aprobado_por_admin),
        usuario: {
          firstName: result.telegramUser?.telegram_first_name || null,
          lastName: result.telegramUser?.telegram_last_name || null,
          rol: result.telegramUser?.rol || "CONDUCTOR"
        },
        conductor: result.conductor
      }
    });

  } catch (error) {
    const statusCode = error instanceof TelegramRegistrationError
      ? error.statusCode
      : 500;

    if (statusCode === 500) {
      console.error("Error registrando conductor de Telegram:", error.message);
    }

    return response.status(statusCode).json({
      success: false,
      message: error.message || "No fue posible registrar al conductor."
    });
  }
}
