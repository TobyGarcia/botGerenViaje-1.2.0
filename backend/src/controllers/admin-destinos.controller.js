import {
  createAdminDestination,
  deleteAdminDestination,
  importAdminDestinations,
  listAdminDestinations,
  toggleAdminDestinationFavorite,
  updateAdminDestination,
  updateAdminDestinationStatus
} from "../services/admin-destinos.service.js";

function normalizeDestinationInput(body) {
  let latitud = null;
  if (body?.latitud !== undefined && body?.latitud !== null && body?.latitud !== "") {
    const parsedLat = Number(body.latitud);
    if (!Number.isNaN(parsedLat)) latitud = parsedLat;
  }

  let longitud = null;
  if (body?.longitud !== undefined && body?.longitud !== null && body?.longitud !== "") {
    const parsedLng = Number(body.longitud);
    if (!Number.isNaN(parsedLng)) longitud = parsedLng;
  }

  return {
    nombre:
      String(
        body?.nombre || ""
      )
        .replace(/\s+/g, " ")
        .trim(),

    direccion:
      String(
        body?.direccion || ""
      )
        .replace(/\s+/g, " ")
        .trim() || null,

    latitud,
    longitud
  };
}

function validateDestinationInput(
  destination
) {
  if (!destination.nombre) {
    return "El nombre del destino es obligatorio.";
  }

  if (destination.nombre.length < 2) {
    return "El nombre del destino debe tener al menos 2 caracteres.";
  }

  if (destination.nombre.length > 150) {
    return "El nombre del destino es demasiado largo (máximo 150 caracteres).";
  }

  if (
    destination.direccion &&
    destination.direccion.length > 500
  ) {
    return "La dirección no puede exceder 500 caracteres.";
  }

  if (destination.latitud !== null && (destination.latitud < -90 || destination.latitud > 90)) {
    return "La latitud debe ser un número válido entre -90 y 90.";
  }

  if (destination.longitud !== null && (destination.longitud < -180 || destination.longitud > 180)) {
    return "La longitud debe ser un número válido entre -180 y 180.";
  }

  return null;
}

export async function listAdminDestinationsController(
  request,
  response
) {
  try {
    const destinations =
      await listAdminDestinations({
        search:
          request.query.search,

        status:
          request.query.status
      });

    return response
      .status(200)
      .json({
        success: true,
        data: destinations
      });
  } catch (error) {
    console.error(
      "Error consultando destinos:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible consultar los destinos."
      });
  }
}

export async function createAdminDestinationController(
  request,
  response
) {
  try {
    const destination =
      normalizeDestinationInput(
        request.body
      );

    const validationError =
      validateDestinationInput(
        destination
      );

    if (validationError) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            validationError
        });
    }

    const createdDestination =
      await createAdminDestination(
        destination
      );

    return response
      .status(201)
      .json({
        success: true,
        data: createdDestination,
        message:
          "Destino creado correctamente."
      });
  } catch (error) {
    if (
      error.code ===
      "DESTINATION_EXISTS"
    ) {
      return response
        .status(409)
        .json({
          success: false,
          message:
            error.message
        });
    }

    if (
      error.code ===
      "DESTINATION_INACTIVE"
    ) {
      return response
        .status(409)
        .json({
          success: false,
          message:
            error.message,

          data: {
            destination:
              error.destination
          }
        });
    }

    console.error(
      "Error creando destino:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible crear el destino."
      });
  }
}

export async function updateAdminDestinationStatusController(
  request,
  response
) {
  try {
    const idDestino =
      Number(
        request.params.idDestino
      );

    const activo =
      request.body?.activo;

    if (
      !Number.isInteger(idDestino) ||
      idDestino <= 0
    ) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del destino no es válido."
        });
    }

    if (typeof activo !== "boolean") {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El estado activo debe ser verdadero o falso."
        });
    }

    const updatedDestination =
      await updateAdminDestinationStatus({
        idDestino,
        activo
      });

    if (!updatedDestination) {
      return response
        .status(404)
        .json({
          success: false,
          message:
            "No se encontró el destino."
        });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: updatedDestination,
        message:
          activo
            ? "Destino reactivado correctamente."
            : "Destino dado de baja correctamente."
      });
  } catch (error) {
    console.error(
      "Error actualizando destino:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible actualizar el destino."
      });
  }
}

export async function toggleAdminDestinationFavoriteController(
  request,
  response
) {
  try {
    const idDestino = Number(request.params.idDestino);

    if (!Number.isInteger(idDestino) || idDestino <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del destino no es válido."
      });
    }

    if (request.body?.es_favorito === undefined && request.body?.esFavorito === undefined) {
      return response.status(400).json({
        success: false,
        message: "Debe indicar el estado de favorito (es_favorito: true/false)."
      });
    }

    const es_favorito = Boolean(
      request.body.es_favorito !== undefined
        ? request.body.es_favorito
        : request.body.esFavorito
    );

    const updatedDestination = await toggleAdminDestinationFavorite({
      idDestino,
      es_favorito
    });

    if (!updatedDestination) {
      return response.status(404).json({
        success: false,
        message: "No se encontró el destino."
      });
    }

    return response.status(200).json({
      success: true,
      data: updatedDestination,
      message: es_favorito
        ? `"${updatedDestination.nombre}" marcado como destino favorito / sugerencia.`
        : `"${updatedDestination.nombre}" removido de destinos favoritos.`
    });
  } catch (error) {
    console.error("Error al cambiar favorito de destino:", error.message);
    return response.status(500).json({
      success: false,
      message: "No fue posible actualizar el estado de favorito del destino."
    });
  }
}

export async function updateAdminDestinationController(
  request,
  response
) {
  try {
    const idDestino = Number(request.params.idDestino);

    if (!Number.isInteger(idDestino) || idDestino <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del destino no es válido."
      });
    }

    const destination = normalizeDestinationInput(request.body);
    const validationError = validateDestinationInput(destination);

    if (validationError) {
      return response.status(400).json({
        success: false,
        message: validationError
      });
    }

    const updatedDestination = await updateAdminDestination({
      idDestino,
      ...destination
    });

    if (!updatedDestination) {
      return response.status(404).json({
        success: false,
        message: "No se encontró el destino."
      });
    }

    return response.status(200).json({
      success: true,
      data: updatedDestination,
      message: "Destino actualizado correctamente."
    });
  } catch (error) {
    if (error.code === "DESTINATION_EXISTS") {
      return response.status(409).json({
        success: false,
        message: error.message
      });
    }

    console.error("Error actualizando destino:", error.message);

    return response.status(500).json({
      success: false,
      message: "No fue posible actualizar el destino."
    });
  }
}

export async function deleteAdminDestinationController(
  request,
  response
) {
  try {
    const idDestino = Number(request.params.idDestino);

    if (!Number.isInteger(idDestino) || idDestino <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del destino no es válido."
      });
    }

    const deleted = await deleteAdminDestination(idDestino);

    if (!deleted) {
      return response.status(404).json({
        success: false,
        message: "No se encontró el destino."
      });
    }

    return response.status(200).json({
      success: true,
      data: deleted,
      message: `El destino "${deleted.nombre}" fue eliminado correctamente.`
    });
  } catch (error) {
    if (error.code === "DESTINATION_HAS_TRIPS") {
      return response.status(409).json({
        success: false,
        message: error.message
      });
    }

    console.error("Error eliminando destino:", error.message);

    return response.status(500).json({
      success: false,
      message: "No fue posible eliminar el destino."
    });
  }
}

export async function importAdminDestinationsController(
  request,
  response
) {
  try {
    const destinations = request.body?.destinations;

    if (!Array.isArray(destinations) || destinations.length === 0) {
      return response.status(400).json({
        success: false,
        message: "Se requiere un arreglo con los destinos a importar."
      });
    }

    if (destinations.length > 10000) {
      return response.status(400).json({
        success: false,
        message: "El lote máximo de importación es de 10,000 registros por solicitud."
      });
    }

    const cleanDestinations = destinations
      .map((d) => normalizeDestinationInput(d))
      .filter((d) => d.nombre.length >= 2);

    if (cleanDestinations.length === 0) {
      return response.status(400).json({
        success: false,
        message: "Ninguno de los destinos en el archivo cuenta con un nombre válido."
      });
    }

    const result = await importAdminDestinations(cleanDestinations);

    return response.status(200).json({
      success: true,
      data: result,
      message: `Se procesaron ${result.total} destinos con éxito (${result.inserted} nuevos, ${result.updated} actualizados).`
    });
  } catch (error) {
    console.error("Error importando destinos:", error.message);

    return response.status(500).json({
      success: false,
      message: "Ocurrió un error al importar los destinos."
    });
  }
}

