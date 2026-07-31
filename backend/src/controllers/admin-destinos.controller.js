import {
  createAdminDestination,
  listAdminDestinations,
  updateAdminDestination,
  updateAdminDestinationStatus
} from "../services/admin-destinos.service.js";

function normalizeDestinationInput(body) {
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
        .trim() || null
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
    return "El nombre del destino es demasiado largo.";
  }

  if (
    destination.direccion &&
    destination.direccion.length > 500
  ) {
    return "La dirección no puede exceder 500 caracteres.";
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
