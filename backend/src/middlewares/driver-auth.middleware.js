import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import { findTelegramUserById } from "../services/telegram-user.service.js";
import { verifyDriverSessionToken, getDriverCookieName } from "../utils/driver-session.js";
import { findActiveDriverById } from "../services/driver-auth.service.js";
import { databasePool } from "../database/pool.js";

export async function requireActiveDriver(request, response, next) {
  try {
    const telegramInitData = request.get("X-Telegram-Init-Data");
    const authHeader = request.get("Authorization");
    const cookieToken = request.cookies?.[getDriverCookieName()];

    let driver = null;
    let authSource = null;

    // 1. Intentar autenticación por Telegram initData
    if (telegramInitData && telegramInitData.trim() !== "") {
      try {
        const telegramData = validateTelegramInitData(telegramInitData, {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 86400)
        });

        const telegramUser = await findTelegramUserById(telegramData.user.id);

        if (!telegramUser?.activo || !telegramUser.id_conductores) {
          return response.status(403).json({
            success: false,
            message: "El usuario de Telegram no está vinculado a un conductor activo."
          });
        }

        if (telegramUser.estado_registro === "PENDIENTE_APROBACION") {
          return response.status(403).json({
            success: false,
            message: "Tu registro de conductor está pendiente de aprobación por la administración."
          });
        }

        driver = await findActiveDriverById(telegramUser.id_conductores);
        authSource = "TELEGRAM";
      } catch (err) {
        console.warn("[DriverAuth] Falló verificación Telegram InitData:", err.message);
      }
    }

    // 2. Fallback: Intentar autenticación Web mediante JWT Bearer / Cookie
    if (!driver) {
      let token = null;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (token) {
        try {
          const payload = verifyDriverSessionToken(token);
          driver = await findActiveDriverById(Number(payload.sub));
          authSource = "WEB_PIN";
        } catch (err) {
          return response.status(401).json({
            success: false,
            message: "Sesión de conductor inválida o expirada."
          });
        }
      }
    }

    if (!driver) {
      return response.status(401).json({
        success: false,
        message: "Autenticación de conductor requerida."
      });
    }

    if (!driver.activo) {
      return response.status(403).json({
        success: false,
        message: "El conductor se encuentra inactivo."
      });
    }

    if (driver.aprobado_por_admin === false) {
      return response.status(403).json({
        success: false,
        message: "El conductor aún no ha sido aprobado por la administración."
      });
    }

    request.driverUser = driver;
    request.authSource = authSource;

    return next();
  } catch (error) {
    console.error("Error en requireActiveDriver middleware:", error);
    return response.status(500).json({
      success: false,
      message: "Error procesando autenticación del conductor."
    });
  }
}
