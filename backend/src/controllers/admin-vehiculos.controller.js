import {
  createAdminVehicle,
  createAdminVehicleMileageReading,
  getAdminVehicleMileageHistory,
  getAdminVehicleMileageSummary,
  listAdminVehicles,
  updateAdminVehicleStatus
} from "../services/admin-vehiculos.service.js";

function parseVehicleId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function canManageMileage(adminUser) {
  return ["ADMINISTRADOR", "SUPERVISOR"].includes(adminUser?.rol);
}

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

export async function getAdminVehicleMileageHistoryController(request, response) {
  try {
    const idVehiculo = parseVehicleId(request.params.idVehiculo);
    if (!idVehiculo) return response.status(400).json({ success: false, message: "El identificador del vehículo no es válido." });
    const data = await getAdminVehicleMileageHistory({
      idVehiculo, dateFrom: request.query.dateFrom, dateTo: request.query.dateTo, type: request.query.type
    });
    if (!data) return response.status(404).json({ success: false, message: "No se encontró el vehículo." });
    return response.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error consultando historial de kilometraje:", error.message);
    return response.status(500).json({ success: false, message: "No fue posible consultar el historial de kilometraje." });
  }
}

export async function getAdminVehicleMileageSummaryController(request, response) {
  try {
    const idVehiculo = parseVehicleId(request.params.idVehiculo);
    if (!idVehiculo) return response.status(400).json({ success: false, message: "El identificador del vehículo no es válido." });
    const data = await getAdminVehicleMileageSummary(idVehiculo);
    if (!data) return response.status(404).json({ success: false, message: "No se encontró el vehículo." });
    return response.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error consultando resumen de kilometraje:", error.message);
    return response.status(500).json({ success: false, message: "No fue posible consultar el resumen de kilometraje." });
  }
}

export async function createAdminVehicleMileageReadingController(request, response) {
  try {
    if (!canManageMileage(request.adminUser)) {
      return response.status(403).json({ success: false, message: "No tienes permiso para registrar ajustes de kilometraje." });
    }
    const idVehiculo = parseVehicleId(request.params.idVehiculo);
    const kilometraje = Number(request.body?.kilometraje);
    const observaciones = String(request.body?.observaciones || "").trim();
    const correctionOf = request.body?.idRegistroCorregido ? Number(request.body.idRegistroCorregido) : null;
    if (!idVehiculo || !Number.isInteger(kilometraje) || kilometraje < 0 || !observaciones) {
      return response.status(400).json({ success: false, message: "Kilometraje entero no negativo y observaciones son obligatorios." });
    }
    if (correctionOf !== null && (!Number.isInteger(correctionOf) || correctionOf <= 0)) {
      return response.status(400).json({ success: false, message: "El registro a corregir no es válido." });
    }
    const data = await createAdminVehicleMileageReading({
      idVehiculo, kilometraje, observaciones,
      idUsuarioAdmin: request.adminUser.id_usuarios_admin, correctionOf
    });
    if (!data) return response.status(404).json({ success: false, message: "No se encontró el vehículo." });
    return response.status(201).json({ success: true, data, message: "Lectura de kilometraje registrada correctamente." });
  } catch (error) {
    const status = ["MILEAGE_DECREASE", "MILEAGE_RECORD_NOT_FOUND"].includes(error.code) ? 409 : 500;
    return response.status(status).json({ success: false, message: error.message || "No fue posible registrar el kilometraje." });
  }
}
