import {
  createTrip,
  startTrip
} from "../services/viajes.service.js";

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

export async function createTripController(
  request,
  response
) {
  try {
    const idConductor =
      parsePositiveInteger(request.body.idConductor);

    const idVehiculo =
      parsePositiveInteger(request.body.idVehiculo);

    const idOrigen =
      parsePositiveInteger(request.body.idOrigen);

    const idDestino =
      parsePositiveInteger(request.body.idDestino);

    const kilometrajeInicial =
      Number(request.body.kilometrajeInicial);

    const motivo =
      String(request.body.motivo || "").trim();

    const acompanantes =
      Array.isArray(request.body.acompanantes)
        ? request.body.acompanantes
        : [];

    if (!idConductor) {
      return response.status(400).json({
        success: false,
        message: "El conductor no es válido."
      });
    }

    if (!idVehiculo) {
      return response.status(400).json({
        success: false,
        message: "El vehículo no es válido."
      });
    }

    if (!idOrigen || !idDestino) {
      return response.status(400).json({
        success: false,
        message: "El origen o destino no es válido."
      });
    }

    if (
      !Number.isInteger(kilometrajeInicial) ||
      kilometrajeInicial < 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "El kilometraje inicial no es válido."
      });
    }

    if (!motivo) {
      return response.status(400).json({
        success: false,
        message:
          "El motivo de movilización es obligatorio."
      });
    }

    const normalizedCompanions =
      acompanantes
        .map((item) => ({
          nombre: String(item?.nombre || "").trim()
        }))
        .filter((item) => item.nombre);

    const trip = await createTrip({
      idConductor,
      idVehiculo,
      idOrigen,
      idDestino,
      acompanantes: normalizedCompanions,
      kilometrajeInicial,
      motivo
    });

    return response.status(201).json({
      success: true,
      message: "Viaje creado correctamente.",
      data: trip
    });
  } catch (error) {
    console.error(
      "Error creando viaje:",
      error
    );

    return response.status(409).json({
      success: false,
      message:
        error.message ||
        "No fue posible crear el viaje."
    });
  }
}
export async function startTripController(
  request,
  response
) {
  try {
    const idViaje =
      parsePositiveInteger(
        request.params.idViaje
      );

    if (!idViaje) {
      return response.status(400).json({
        success: false,
        message:
          "El identificador del viaje no es válido."
      });
    }

    const trip = await startTrip({
      idViaje
    });

    return response.status(200).json({
      success: true,
      message:
        "Viaje iniciado correctamente.",
      data: trip
    });
  } catch (error) {
    console.error(
      "Error iniciando viaje:",
      error
    );

    const conflictMessages = [
      "no puede iniciarse",
      "no está vigente",
      "está inactivo",
      "ya está asignado"
    ];

    const isConflict =
      conflictMessages.some((message) =>
        error.message.includes(message)
      );

    const statusCode =
      error.message === "El viaje no existe."
        ? 404
        : isConflict
          ? 409
          : 500;

    return response.status(statusCode).json({
      success: false,
      message:
        error.message ||
        "No fue posible iniciar el viaje."
    });
  }
}
