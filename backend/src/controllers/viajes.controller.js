import {
  cancelTrip,
  createTrip,
  finishTrip,
  getActiveTrip,
  getTripById,
  startTrip
} from "../services/viajes.service.js";
import { sendTripGroupAlert } from "../bot/bot.js";

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

function normalizeTripResponse(trip) {
  return {
    idViaje: trip.id_viajes,
    folio: trip.folio,
    fecha: trip.fecha,

    conductor: {
      idConductor: trip.id_conductores,
      nombre: trip.conductor,
      licenciaNumero:
        trip.licencia_numero,
      licenciaVigente:
        trip.licencia_actual_vigente ??
        trip.licencia_vigente
    },

    vehiculo: {
      idVehiculo: trip.id_vehiculos,
      nombre: trip.vehiculo,
      numeroEconomico:
        trip.numero_economico,
      placas: trip.placas,
      kilometrajeActual:
        trip.kilometraje_actual
    },

    origen: {
      idLugar: trip.id_origen,
      nombre: trip.origen
    },

    destino: {
      idLugar: trip.id_destino,
      nombre: trip.destino
    },

    acompanantes:
      trip.acompanantes ?? [],

    motivo: trip.motivo,

    estado: trip.estado,

    kilometrajeInicial:
      trip.kilometraje_inicial,

    kilometrajeFinal:
      trip.kilometraje_final,

    kilometrosRecorridos:
      trip.kilometros_recorridos,

    horaSalida:
      trip.hora_salida,

    horaLlegada:
      trip.hora_llegada,

    ultimaUbicacion:
      trip.latitud !== null &&
      trip.latitud !== undefined
        ? {
            latitude: trip.latitud,
            longitude: trip.longitud,
            accuracy:
              trip.precision_metros,
            speed: trip.velocidad,
            heading: trip.direccion,
            gpsTimestamp:
              trip.fecha_gps,
            serverTimestamp:
              trip.ubicacion_creada_en
          }
        : null
  };
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

    await sendTripGroupAlert({ action: "iniciado", trip });

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
export async function finishTripController(
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

    const kilometrajeFinal =
      Number(
        request.body.kilometrajeFinal
      );

    if (
      !Number.isInteger(kilometrajeFinal) ||
      kilometrajeFinal < 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "El kilometraje final no es válido."
      });
    }

    const trip = await finishTrip({
      idViaje,
      kilometrajeFinal
    });

    await sendTripGroupAlert({ action: "finalizado", trip });

    return response.status(200).json({
      success: true,
      message:
        "Viaje finalizado correctamente.",
      data: trip
    });
  } catch (error) {
    console.error(
      "Error finalizando viaje:",
      error
    );

    let statusCode = 500;

    if (error.message === "El viaje no existe.") {
      statusCode = 404;
    } else if (
      error.message.includes(
        "no puede finalizarse"
      ) ||
      error.message.includes(
        "kilometraje final"
      )
    ) {
      statusCode = 409;
    }

    return response.status(statusCode).json({
      success: false,
      message:
        error.message ||
        "No fue posible finalizar el viaje."
    });
  }
}
export async function cancelTripController(
  request,
  response
) {
  try {
    const idViaje = parsePositiveInteger(request.params.idViaje);

    if (!idViaje) {
      return response.status(400).json({
        success: false,
        message: "El identificador del viaje no es válido."
      });
    }

    const trip = await cancelTrip({ idViaje });

    await sendTripGroupAlert({ action: "cancelado", trip });

    return response.status(200).json({
      success: true,
      message: "Viaje cancelado correctamente.",
      data: trip
    });
  } catch (error) {
    console.error("Error cancelando viaje:", error);

    const statusCode = error.message === "El viaje no existe."
      ? 404
      : error.message.includes("no puede cancelarse")
        ? 409
        : 500;

    return response.status(statusCode).json({
      success: false,
      message: error.message || "No fue posible cancelar el viaje."
    });
  }
}

export async function getActiveTripController(
  request,
  response
) {
  try {
    const trip = await getActiveTrip();

    return response.status(200).json({
      success: true,
      data: trip
        ? normalizeTripResponse(trip)
        : null
    });
  } catch (error) {
    console.error(
      "Error consultando viaje activo:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar el viaje activo."
    });
  }
}

export async function getTripByIdController(
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

    const trip = await getTripById({
      idViaje
    });

    if (!trip) {
      return response.status(404).json({
        success: false,
        message: "El viaje no existe."
      });
    }

    return response.status(200).json({
      success: true,
      data: normalizeTripResponse(trip)
    });
  } catch (error) {
    console.error(
      "Error consultando viaje:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar el viaje."
    });
  }
}
