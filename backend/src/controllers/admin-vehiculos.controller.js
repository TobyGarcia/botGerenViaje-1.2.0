import {
  createAdminVehicle,
  listAdminVehicles,
  updateAdminVehicleStatus
} from "../services/admin-vehiculos.service.js";

function normalizeVehicleInput(body) {
  return {
    marca:
      String(
        body?.marca || ""
      ).trim(),

    modelo:
      String(
        body?.modelo || ""
      ).trim(),

    numeroEconomico:
      String(
        body?.numeroEconomico || ""
      ).trim(),

    placas:
      String(
        body?.placas || ""
      )
        .trim()
        .toUpperCase()
  };
}

function validateVehicleInput(vehicle) {
  if (vehicle.marca.length < 2) {
    return "La marca es obligatoria.";
  }

  if (vehicle.modelo.length < 1) {
    return "El modelo es obligatorio.";
  }

  if (!vehicle.numeroEconomico) {
    return "El número económico es obligatorio.";
  }

  if (!vehicle.placas) {
    return "Las placas son obligatorias.";
  }

  if (
    vehicle.numeroEconomico.length > 50
  ) {
    return "El número económico es demasiado largo.";
  }

  if (vehicle.placas.length > 20) {
    return "El número de placas es demasiado largo.";
  }

  return null;
}

export async function listAdminVehiclesController(
  request,
  response
) {
  try {
    const vehicles =
      await listAdminVehicles({
        search:
          request.query.search,

        status:
          request.query.status
      });

    return response
      .status(200)
      .json({
        success: true,
        data: vehicles
      });
  } catch (error) {
    console.error(
      "Error consultando vehículos:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible consultar los vehículos."
      });
  }
}

export async function createAdminVehicleController(
  request,
  response
) {
  try {
    const vehicle =
      normalizeVehicleInput(
        request.body
      );

    const validationError =
      validateVehicleInput(vehicle);

    if (validationError) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            validationError
        });
    }

    const createdVehicle =
      await createAdminVehicle(
        vehicle
      );

    return response
      .status(201)
      .json({
        success: true,
        data: createdVehicle,
        message:
          "Vehículo creado correctamente."
      });
  } catch (error) {
    if (
      error.code ===
      "VEHICLE_DUPLICATE"
    ) {
      return response
        .status(409)
        .json({
          success: false,
          message:
            error.message
        });
    }

    console.error(
      "Error creando vehículo:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible crear el vehículo."
      });
  }
}

export async function updateAdminVehicleStatusController(
  request,
  response
) {
  try {
    const idVehiculo =
      Number(
        request.params.idVehiculo
      );

    const activo =
      request.body?.activo;

    if (
      !Number.isInteger(idVehiculo) ||
      idVehiculo <= 0
    ) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del vehículo no es válido."
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

    const updatedVehicle =
      await updateAdminVehicleStatus({
        idVehiculo,
        activo
      });

    if (!updatedVehicle) {
      return response
        .status(404)
        .json({
          success: false,
          message:
            "No se encontró el vehículo."
        });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: updatedVehicle,
        message:
          activo
            ? "Vehículo reactivado correctamente."
            : "Vehículo dado de baja correctamente."
      });
  } catch (error) {
    console.error(
      "Error actualizando vehículo:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible actualizar el vehículo."
      });
  }
}
