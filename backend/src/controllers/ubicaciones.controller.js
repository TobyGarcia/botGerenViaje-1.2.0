import {
  saveTripLocation
} from "../services/ubicaciones.service.js";

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