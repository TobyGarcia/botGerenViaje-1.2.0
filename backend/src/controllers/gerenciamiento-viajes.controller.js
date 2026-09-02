import {
  notifyNewGerenciamientoRequest,
  notifyGerenciamientoCheckpoint
} from "../bot/supervisor-bot.js";
import { findTelegramUserById } from "../services/telegram-user.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import {
  createGerenciamientoViaje,
  getGerenciamientoById,
  getGerenciamientoByViaje,
  listGerenciamientos,
  aprovarGerenciamiento,
  registrarReporteHoraPoint
} from "../services/gerenciamiento-viajes.service.js";

async function authenticateDriver(request) {
  const initDataHeader = request.get("X-Telegram-Init-Data") || "";
  if (!initDataHeader) {
    throw new Error("No se proporcionó información de autenticación de Telegram.");
  }
  const telegramData = validateTelegramInitData(initDataHeader, {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 86400)
  });
  const telegramUser = await findTelegramUserById(telegramData.user.id);
  if (!telegramUser?.id_conductores || !telegramUser.activo) {
    throw new Error("El usuario de Telegram no tiene un conductor activo asociado.");
  }
  return telegramUser;
}

export async function createGerenciamientoController(request, response) {
  try {
    const telegramUser = await authenticateDriver(request);
    const idConductor = telegramUser.id_conductores;

    const payload = request.body || {};
    if (!payload.firmaConductor) {
      throw new Error("La firma del conductor es obligatoria para el Gerenciamiento de Viaje.");
    }

    const result = await createGerenciamientoViaje({
      idConductor,
      data: {
        ...payload,
        nombreConductor: payload.nombreConductor || telegramUser.conductor_nombre
      }
    });

    // Notificar al grupo de supervisores en Telegram
    notifyNewGerenciamientoRequest({
      idGerenciamiento: result.id_gerenciamiento,
      folio: result.folio_documento,
      conductor: result.nombre_conductor,
      vehiculo: `${result.tipo_vehiculo || 'Unidad'} (${result.numero_unidad || 'N/A'})`,
      origen: result.origen_nombre || result.origen_texto,
      destino: result.destino_nombre || result.destino_texto,
      puntajeTotal: result.puntaje_total,
      nivelRiesgo: result.nivel_riesgo,
      autorizacionRequerida: result.autorizacion_requerida
    }).catch((err) => console.error("Error al notificar gerenciamiento a Telegram:", err.message));

    return response.status(201).json({
      success: true,
      message: "Gerenciamiento de Viaje registrado correctamente.",
      data: result
    });
  } catch (error) {
    return response.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getGerenciamientoByIdController(request, response) {
  try {
    const idGerenciamiento = Number(request.params.id);
    const data = await getGerenciamientoById(idGerenciamiento);
    if (!data) {
      return response.status(404).json({ success: false, message: "Gerenciamiento de viaje no encontrado." });
    }
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function getGerenciamientoByViajeController(request, response) {
  try {
    const idViaje = Number(request.params.idViaje);
    const data = await getGerenciamientoByViaje(idViaje);
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function listGerenciamientosController(request, response) {
  try {
    const { estado, nivelRiesgo, idConductor, limit, offset } = request.query;
    const list = await listGerenciamientos({
      estado,
      nivelRiesgo,
      idConductor: idConductor ? Number(idConductor) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
    return response.json({ success: true, data: list });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function aprovarGerenciamientoController(request, response) {
  try {
    const idGerenciamiento = Number(request.params.id);
    const { idUsuarioAdmin, nombreAutorizador, firmaAutorizador, estado, observaciones } = request.body || {};

    if (!nombreAutorizador) {
      throw new Error("El nombre del autorizador es requerido.");
    }

    const updated = await aprovarGerenciamiento({
      idGerenciamiento,
      idUsuarioAdmin: idUsuarioAdmin ? Number(idUsuarioAdmin) : null,
      nombreAutorizador,
      firmaAutorizador,
      estado: estado || 'APROBADO',
      observaciones
    });

    if (!updated) {
      return response.status(404).json({ success: false, message: "No se encontró el registro para actualizar." });
    }

    return response.json({
      success: true,
      message: `Gerenciamiento ${estado || 'APROBADO'} exitosamente.`,
      data: updated
    });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function registrarReporteHoraController(request, response) {
  try {
    const idGerenciamiento = Number(request.params.id);
    const { puntoIndex, horaReportada } = request.body || {};
    if (puntoIndex === undefined || puntoIndex === null) {
      throw new Error("Se requiere el índice del punto de reporte.");
    }
    const updated = await registrarReporteHoraPoint({
      idGerenciamiento,
      puntoIndex: Number(puntoIndex),
      horaReportada
    });

    // Enviar alerta automática al grupo de Telegram de Supervisores
    const pIdx = Number(puntoIndex);
    const puntoObj = updated?.sitios_reporte?.[pIdx] || {};
    notifyGerenciamientoCheckpoint({
      folio: updated?.folio_documento,
      idGerenciamiento: updated?.id_gerenciamiento,
      conductor: updated?.nombre_conductor,
      puntoNombre: puntoObj.punto || `Punto ${pIdx + 1}`,
      puntoNumero: pIdx + 1,
      horaReportada: puntoObj.horaReportada || horaReportada
    }).catch((err) => console.error("Error enviando notificación de fichaje a Telegram:", err));

    return response.json({
      success: true,
      message: "Hora de sitio de reporte registrada correctamente.",
      data: updated
    });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}
