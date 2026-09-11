import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import { findTelegramUserById } from "../services/telegram-user.service.js";
import { verifyDriverSessionToken, getDriverCookieName } from "../utils/driver-session.js";
import { findActiveDriverById, findDriverById } from "../services/driver-auth.service.js";
import { databasePool } from "../database/pool.js";

export async function requireActiveDriver(request, response, next) {
  try {
    const telegramInitData = request.get("X-Telegram-Init-Data");
    const authHeader = request.get("Authorization");
    const cookieToken = request.cookies?.[getDriverCookieName()];

    let driver = null;
    let authSource = null;

    // 1. Prioridad: Intentar autenticación mediante JWT Bearer / Cookie (Ingreso por PIN)
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (token) {
      try {
        const payload = verifyDriverSessionToken(token);
        driver = await findDriverById(Number(payload.sub));
        if (driver) {
          authSource = "WEB_PIN";
        }
      } catch (err) {
        // Token no válido o expirado, continuar con fallback
      }
    }

    // 2. Fallback: Intentar autenticación por Telegram initData si no hay sesión PIN activa
    if (!driver && telegramInitData && telegramInitData.trim() !== "") {
      try {
        const telegramData = validateTelegramInitData(telegramInitData, {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 86400)
        });

        const telegramUser = await findTelegramUserById(telegramData.user.id);

        if (!telegramUser?.activo || !telegramUser.id_conductores) {
          return response.status(403).json({
            success: false,
            code: "CONDUCTOR_INACTIVE",
            message: "Tu acceso ha sido restringido o deshabilitado por la administración. Contacta a tu supervisor."
          });
        }

        if (telegramUser.estado_registro === "PENDIENTE_APROBACION") {
          return response.status(403).json({
            success: false,
            code: "PENDING_APPROVAL",
            message: "Tu registro de conductor está pendiente de aprobación por la administración."
          });
        }

        driver = await findDriverById(telegramUser.id_conductores);
        authSource = "TELEGRAM";
      } catch (err) {
        console.warn("[DriverAuth] Falló verificación Telegram InitData:", err.message);
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
        code: "CONDUCTOR_INACTIVE",
        message: "Tu acceso ha sido restringido o deshabilitado por la administración. Contacta a tu supervisor."
      });
    }

    if (driver.aprobado_por_admin === false) {
      return response.status(403).json({
        success: false,
        code: "PENDING_APPROVAL",
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
