import {
  deleteAdminTrip,
  getAdminDashboardSummary,
  getAdminTripById,
  listAdminTrips
} from "../services/admin-viajes.service.js";

export async function getAdminDashboardSummaryController(request, response) {
  try {
    const summary = await getAdminDashboardSummary();
    return response.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error consultando resumen administrativo:", error);
    return response.status(500).json({
      success: false,
      message: "No fue posible consultar el resumen administrativo."
    });
  }
}

function parsePositiveInteger(value) {
  const parsedValue =
    Number(value);

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

  const parsedValue =
    Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function serializeTrip(row) {
  return {
    idViaje:
      Number(row.id_viajes),

    folio:
      row.folio,

    fecha:
      row.fecha,

    estado: {
      id:
        Number(
          row.id_estado_viaje
        ),

      nombre:
        row.estado
    },

    conductor: {
      id:
        Number(
          row.id_conductores
        ),

      nombre:
        row.conductor
    },

    vehiculo: {
      id:
        Number(
          row.id_vehiculos
        ),

      nombre:
        row.vehiculo,

      numeroEconomico:
        row.numero_economico,

      placas:
        row.placas
    },

    origen: {
      id:
        Number(row.id_origen),

      nombre:
        row.origen,

      direccion:
        row.origen_direccion
    },

    destino: {
      id:
        Number(row.id_destino),

      nombre:
        row.destino,

      direccion:
        row.destino_direccion
    },

    acompanantes:
      Array.isArray(row.acompanantes)
        ? row.acompanantes
        : [],

    licenciaVigente:
      row.licencia_vigente,

    kilometrajeInicial:
      parseNullableNumber(
        row.kilometraje_inicial
      ),

    kilometrajeFinal:
      parseNullableNumber(
        row.kilometraje_final
      ),

    kilometrosRecorridos:
      parseNullableNumber(
        row.kilometros_recorridos
      ),

    motivo:
      row.motivo,

    horaSalida:
      row.hora_salida,

    horaLlegada:
      row.hora_llegada,

    totalUbicaciones:
      parseNullableNumber(
        row.total_ubicaciones
      ),

    creadoEn:
      row.creado_en,

    actualizadoEn:
      row.actualizado_en
  };
}

export async function listAdminTripsController(
  request,
  response
) {
  try {
    const rows =
      await listAdminTrips({
        search:
          request.query.search,

        status:
          request.query.status,

        dateFrom:
          request.query.dateFrom,

        dateTo:
          request.query.dateTo,

        idConductor:
          request.adminUser.rol === "OPERADOR"
            ? request.adminUser.id_conductores
            : null
      });

    return response
      .status(200)
      .json({
        success: true,
        data:
          rows.map(serializeTrip)
      });
  } catch (error) {
    console.error(
      "Error consultando viajes administrativos:",
      {
        message: error.message,
        code: error.code,
        detail: error.detail,
        position: error.position,
        table: error.table,
        column: error.column
      }
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible consultar los viajes."
      });
  }
}

export async function getAdminTripController(
  request,
  response
) {
  try {
    const idViaje =
      parsePositiveInteger(
        request.params.idViaje
      );

    if (!idViaje) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del viaje no es válido."
        });
    }

    const result =
      await getAdminTripById(
        idViaje,
        request.adminUser.rol === "OPERADOR"
          ? request.adminUser.id_conductores
          : null
      );

    if (!result) {
      return response
        .status(404)
        .json({
          success: false,
          message:
            "No se encontró el viaje."
        });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: {
          trip:
            serializeTrip(
              result.trip
            ),

          locations:
            result.locations
        }
      });
  } catch (error) {
    console.error(
      "Error consultando detalle del viaje:",
      error
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible consultar el viaje."
      });
  }
}

export async function deleteAdminTripController(
  request,
  response
) {
  try {
    const idViaje =
      parsePositiveInteger(
        request.params.idViaje
      );

    if (!idViaje) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del viaje no es válido."
        });
    }

    const result =
      await deleteAdminTrip(
        idViaje
      );

    if (!result) {
      return response
        .status(404)
        .json({
          success: false,
          message:
            "No se encontró el viaje."
        });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: result,
        message:
          `El viaje ${result.folio} fue eliminado correctamente.`
      });
  } catch (error) {
    console.error(
      "Error eliminando viaje:",
      {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint:
          error.constraint
      }
    );

    if (error.code === "23503") {
      return response
        .status(409)
        .json({
          success: false,
          message:
            "El viaje tiene registros relacionados que impiden eliminarlo."
        });
    }

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible eliminar el viaje."
      });
  }
}
