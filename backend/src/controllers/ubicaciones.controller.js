import {
  saveTripLocationBatch,
  saveTripLocation
} from "../services/ubicaciones.service.js";
import { findTelegramUserById } from "../services/telegram-user.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";

const MAX_BATCH_SIZE = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) &&
    parsedValue > 0
    ? parsedValue
    : null;
}

function parseNullableNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

export async function registerTripLocationController(
  request,
  response
) {
  try {
    const idViaje = parsePositiveInteger(
      request.params.idViaje
    );

    if (!idViaje) {
      return response.status(400).json({
        success: false,
        message:
          "El identificador del viaje no es válido."
      });
    }

    const latitude = Number(
      request.body.latitude
    );

    const longitude = Number(
      request.body.longitude
    );

    const accuracy = parseNullableNumber(
      request.body.accuracy
    );

    const speed = parseNullableNumber(
      request.body.speed
    );

    const heading = parseNullableNumber(
      request.body.heading
    );

    const gpsTimestamp = request.body.gpsTimestamp
      ? new Date(request.body.gpsTimestamp)
      : new Date();

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return response.status(400).json({
        success: false,
        message: "La latitud no es válida."
      });
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return response.status(400).json({
        success: false,
        message: "La longitud no es válida."
      });
    }

    if (latitude === 0 && longitude === 0) {
      return response.status(400).json({
        success: false,
        message: "La ubicación GPS no contiene coordenadas válidas."
      });
    }

    if (
      accuracy !== null &&
      accuracy < 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "La precisión GPS no es válida."
      });
    }

    if (
      speed !== null &&
      speed < 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "La velocidad GPS no es válida."
      });
    }

    if (
      heading !== null &&
      (heading < 0 || heading > 360)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "La dirección GPS no es válida."
      });
    }

    if (
      Number.isNaN(gpsTimestamp.getTime())
    ) {
      return response.status(400).json({
        success: false,
        message:
          "La fecha de la ubicación no es válida."
      });
    }

    const location = await saveTripLocation({
      idViaje,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      gpsTimestamp
    });

    return response.status(201).json({
      success: true,
      message: "Ubicación registrada.",
      data: {
        idUbicacion:
          location.id_ubicaciones_viaje,

        idViaje:
          location.id_viajes,

        folio:
          location.folio,

        latitude:
          location.latitud,

        longitude:
          location.longitud,

        accuracy:
          location.precision_metros,

        speed:
          location.velocidad,

        heading:
          location.direccion,

        gpsTimestamp:
          location.fecha_gps,

        serverTimestamp:
          location.creado_en
      }
    });
  } catch (error) {
    console.error(
      "Error registrando ubicación:",
      error
    );

    const statusCode =
      error.message === "El viaje no existe."
        ? 404
        : error.message.includes(
            "No se pueden registrar ubicaciones"
          )
          ? 409
          : 500;

    return response.status(statusCode).json({
      success: false,
      message:
        error.message ||
        "No fue posible registrar la ubicación."
    });
  }
}

function normalizeBatchLocation(location) {
  const latitud = Number(location?.latitud);
  const longitud = Number(location?.longitud);
  const precisionMetros = parseNullableNumber(location?.precisionMetros);
  const velocidad = parseNullableNumber(location?.velocidad);
  const direccion = parseNullableNumber(location?.direccion);
  const fechaGps = new Date(location?.fechaGps);
  const clientLocationId = String(location?.clientLocationId || "");

  if (!UUID_PATTERN.test(clientLocationId)) {
    return { valid: false, reason: "clientLocationId no es válido." };
  }

  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    return { valid: false, reason: "La latitud no es válida." };
  }

  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return { valid: false, reason: "La longitud no es válida." };
  }

  if (latitud === 0 && longitud === 0) {
    return { valid: false, reason: "La ubicación GPS no contiene coordenadas válidas." };
  }

  if (precisionMetros !== null && precisionMetros < 0) {
    return { valid: false, reason: "La precisión GPS no es válida." };
  }

  if (velocidad !== null && velocidad < 0) {
    return { valid: false, reason: "La velocidad GPS no es válida." };
  }

  if (direccion !== null && (direccion < 0 || direccion > 360)) {
    return { valid: false, reason: "La dirección GPS no es válida." };
  }

  if (Number.isNaN(fechaGps.getTime())) {
    return { valid: false, reason: "La fecha GPS no es válida." };
  }

  return {
    valid: true,
    location: {
      clientLocationId,
      latitud,
      longitud,
      precisionMetros,
      velocidad,
      direccion,
      fechaGps
    }
  };
}

export async function registerTripLocationBatchController(request, response) {
  try {
    const idViaje = parsePositiveInteger(request.params.idViaje);
    const initData = request.get("X-Telegram-Init-Data") || "";
    const locations = request.body?.ubicaciones;

    if (!idViaje) {
      return response.status(400).json({ success: false, message: "El identificador del viaje no es válido." });
    }

    if (!Array.isArray(locations) || locations.length === 0 || locations.length > MAX_BATCH_SIZE) {
      return response.status(400).json({ success: false, message: `El lote debe contener entre 1 y ${MAX_BATCH_SIZE} ubicaciones.` });
    }

    const telegramData = validateTelegramInitData(initData, {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600)
    });
    const telegramUser = await findTelegramUserById(telegramData.user.id);

    if (!telegramUser?.activo || !telegramUser?.conductor_activo || !telegramUser.id_conductores) {
      return response.status(403).json({ success: false, message: "El usuario de Telegram no tiene un conductor activo asociado." });
    }

    const normalized = locations.map(normalizeBatchLocation);
    const validLocations = normalized
      .filter((item) => item.valid)
      .map((item) => item.location);
    const rejected = normalized.length - validLocations.length;

    const result = await saveTripLocationBatch({
      idViaje,
      idConductor: telegramUser.id_conductores,
      locations: validLocations
    });

    return response.status(200).json({
      success: true,
      data: {
        recibidas: locations.length,
        insertadas: result.inserted,
        duplicadas: result.duplicates,
        rechazadas: rejected
      }
    });
  } catch (error) {
    console.error("Error sincronizando ubicaciones:", error);
    const statusCode = error.message === "El viaje no existe."
      ? 404
      : error.message.includes("no pertenece")
        ? 403
        : error.message.includes("initData") || error.message.includes("firma")
          ? 401
        : error.message.includes("no pueden registrar") || error.message.includes("fuera del periodo")
          ? 409
          : 500;

    return response.status(statusCode).json({
      success: false,
      message: error.message || "No fue posible sincronizar las ubicaciones."
    });
  }
}
