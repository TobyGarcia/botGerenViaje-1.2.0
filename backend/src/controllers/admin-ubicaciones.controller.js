import {
  getAdminTripLocationDetail,
  listAdminTripLocations
} from "../services/admin-ubicaciones.service.js";

function parsePositiveInteger(value) {
  const parsedValue =
    Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
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

function serializeLocation(location) {
  return {
    idUbicacion:
      Number(
        location.id_ubicaciones_viaje
      ),

    idViaje:
      Number(location.id_viajes),

    latitud:
      Number(location.latitud),

    longitud:
      Number(location.longitud),

    precisionMetros:
      parseNullableNumber(
        location.precision_metros
      ),

    velocidad:
      parseNullableNumber(
        location.velocidad
      ),

    direccionGrados:
      parseNullableNumber(
        location.direccion
      ),

    esPuntoIntermedio:
      Boolean(
        location.es_punto_intermedio ||
        location.esPuntoIntermedio
      ),

    nombrePunto:
      location.nombre_punto ||
      location.nombrePunto ||
      null,

    fechaGps:
      location.fecha_gps,

    creadoEn:
      location.creado_en
  };
}

function serializeTripSummary(row) {
  return {
    idViaje:
      Number(row.id_viajes),

    folio:
      row.folio,

    fecha:
      row.fecha,

    estado:
      row.estado,

    horaSalida:
      row.hora_salida,

    horaLlegada:
      row.hora_llegada,

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
        Number(
          row.origen_id
        ),

      nombre:
        row.origen
    },

    destino: {
      id:
        Number(
          row.destino_id
        ),

      nombre:
        row.destino
    },

    totalUbicaciones:
      Number(
        row.total_ubicaciones
      ),

    primeraUbicacionEn:
      row.primera_ubicacion_en,

    ultimaUbicacionEn:
      row.ultima_ubicacion_en,

    ultimaUbicacion: {
      idUbicacion:
        Number(
          row.ultima_ubicacion_id
        ),

      latitud:
        Number(
          row.ultima_latitud
        ),

      longitud:
        Number(
          row.ultima_longitud
        ),

      precisionMetros:
        parseNullableNumber(
          row.ultima_precision_metros
        ),

      velocidad:
        parseNullableNumber(
          row.ultima_velocidad
        ),

      direccionGrados:
        parseNullableNumber(
          row.ultima_direccion_grados
        ),

      fechaGps:
        row.ultima_fecha_gps
    }
  };
}

export async function listAdminTripLocationsController(
  request,
  response
) {
  try {
    const rows =
      await listAdminTripLocations({
        search:
          request.query.search,

        status:
          request.query.status,

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
          rows.map(
            serializeTripSummary
          )
      });
  } catch (error) {
    console.error(
      "Error consultando ubicaciones GPS:",
      {
        message: error.message,
        code: error.code,
        detail: error.detail,
        position: error.position,
        table: error.table,
        column: error.column,
        constraint: error.constraint
      }
    );

    return response
      .status(500)
      .json({
        success: false,

        message:
          "No fue posible consultar las ubicaciones GPS."
      });
  }
}

export async function getAdminTripLocationDetailController(
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
      await getAdminTripLocationDetail(
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
          trip: {
            idViaje:
              Number(
                result.trip.id_viajes
              ),

            folio:
              result.trip.folio,

            fecha:
              result.trip.fecha,

            estado:
              result.trip.estado,

            horaSalida:
              result.trip.hora_salida,

            horaLlegada:
              result.trip.hora_llegada,

            motivo:
              result.trip.motivo,

            conductor: {
              id:
                Number(
                  result.trip
                    .id_conductores
                ),

              nombre:
                result.trip
                  .conductor
            },

            vehiculo: {
              id:
                Number(
                  result.trip
                    .id_vehiculos
                ),

              nombre:
                result.trip
                  .vehiculo,

              numeroEconomico:
                result.trip
                  .numero_economico,

              placas:
                result.trip
                  .placas
            },

            origen: {
              id:
                Number(
                  result.trip
                    .origen_id
                ),

              nombre:
                result.trip
                  .origen,

              direccion:
                result.trip
                  .origen_direccion
            },

            destino: {
              id:
                Number(
                  result.trip
                    .destino_id
                ),

              nombre:
                result.trip
                  .destino,

              direccion:
                result.trip
                  .destino_direccion
            }
          },

          totalUbicaciones:
            result.locations.length,

          locations:
            result.locations.map(
              serializeLocation
            )
        }
      });
  } catch (error) {
    console.error(
      "Error consultando ubicaciones GPS:",
      {
        message: error.message,
        code: error.code,
        detail: error.detail,
        position: error.position,
        table: error.table,
        column: error.column,
        constraint: error.constraint
      }
    );

    return response
      .status(500)
      .json({
        success: false,

        message:
          "No fue posible consultar el recorrido GPS."
      });
  }
}
