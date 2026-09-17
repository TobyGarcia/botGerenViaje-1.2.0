import {
  finalizeSupervisorShift,
  getSupervisorAssignedVehicleTurnStatus,
  getSupervisorTurnHistory,
  startSupervisorShift,
  TurnosVehiculoError
} from "../services/turnos-vehiculo.service.js";
import { getSupervisorAccess } from "../services/supervisor-telegram.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";

export async function resolveSupervisorUser(request) {
  const allowedRoles = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"];
  
  if (request.adminUser) {
    if (!request.adminUser.activo || !allowedRoles.includes(request.adminUser.rol)) {
      throw Object.assign(new Error("Tu cuenta no tiene permisos de supervisión."), { statusCode: 403 });
    }
    return request.adminUser;
  }

  const telegramHeader = request.get("X-Telegram-Init-Data") || "";
  if (telegramHeader) {
    let telegramData;
    try {
      telegramData = validateTelegramInitData(telegramHeader, {
        botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
        maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
      });
    } catch {
      telegramData = validateTelegramInitData(telegramHeader, {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
      });
    }

    if (telegramData?.user?.id) {
      const access = await getSupervisorAccess(telegramData.user.id);
      if (access?.user?.activo && allowedRoles.includes(access.user.rol)) {
        return access.user;
      }
    }
  }

  throw Object.assign(new Error("No se pudo verificar la sesión del supervisor."), { statusCode: 401 });
}

export async function getAssignedVehicleTurnStatusController(request, response) {
  try {
    const supervisor = await resolveSupervisorUser(request);
    const data = await getSupervisorAssignedVehicleTurnStatus(supervisor.id_usuarios_admin);
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function finalizeTurnController(request, response) {
  try {
    const supervisor = await resolveSupervisorUser(request);
    const idVehiculo = Number(request.body?.idVehiculo);
    const odometroFinal = Number(request.body?.odometroFinal);
    const observaciones = String(request.body?.observaciones || "");

    if (!Number.isInteger(idVehiculo) || idVehiculo <= 0) {
      return response.status(400).json({ success: false, message: "Identificador de vehículo no válido." });
    }

    const result = await finalizeSupervisorShift({
      idVehiculo,
      idUsuarioAdmin: supervisor.id_usuarios_admin,
      odometroFinal,
      observaciones
    });

    return response.json({
      success: true,
      data: result,
      message: "Turno finalizado correctamente. La unidad queda registrada en traslado a domicilio."
    });
  } catch (error) {
    return response.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function startTurnController(request, response) {
  try {
    const supervisor = await resolveSupervisorUser(request);
    const idVehiculo = Number(request.body?.idVehiculo);
    const odometroInicial = Number(request.body?.odometroInicial);
    const observaciones = String(request.body?.observaciones || "");

    if (!Number.isInteger(idVehiculo) || idVehiculo <= 0) {
      return response.status(400).json({ success: false, message: "Identificador de vehículo no válido." });
    }

    const result = await startSupervisorShift({
      idVehiculo,
      idUsuarioAdmin: supervisor.id_usuarios_admin,
      odometroInicial,
      observaciones
    });

    return response.json({
      success: true,
      data: result,
      message: `Inicio de turno registrado. Se contabilizaron ${result.kmRecorridosCasa} km de traslado a casa.`
    });
  } catch (error) {
    return response.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function getTurnHistoryController(request, response) {
  try {
    await resolveSupervisorUser(request);
    const idVehiculo = Number(request.params.idVehiculo);
    if (!Number.isInteger(idVehiculo) || idVehiculo <= 0) {
      return response.status(400).json({ success: false, message: "Identificador de vehículo no válido." });
    }
    const data = await getSupervisorTurnHistory(idVehiculo);
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}
