import {
  assignVehicleToDriver,
  createAdminDriver,
  listAdminDrivers,
  updateAdminDriverStatus,
  approveAdminDriver
} from "../services/admin-conductores.service.js";
import { setDriverPin } from "../services/driver-auth.service.js";


function normalizeDriverInput(body) {
  return {
    nombre:
      String(
        body?.nombre || ""
      ).trim(),

    telefono:
      String(
        body?.telefono || ""
      ).trim(),

    licenciaNumero:
      String(
        body?.licenciaNumero || ""
      ).trim(),

    tipoLicencia: String(body?.tipoLicencia || "").trim(),

    empresa: String(body?.empresa || "").trim().toUpperCase(),

    licenciaVencimiento:
      String(
        body?.licenciaVencimiento || ""
      ).trim(),

    fechaManejoComentado:
      String(
        body?.fechaManejoComentado || ""
      ).trim()
  };
}


function validateDriverInput(driver) {
  if (driver.nombre.length < 3) {
    return "El nombre debe tener al menos 3 caracteres.";
  }

  if (
    driver.telefono &&
    !/^[0-9+\-\s()]{7,20}$/.test(
      driver.telefono
    )
  ) {
    return "El teléfono no tiene un formato válido.";
  }

  if (!driver.licenciaNumero) {
    return "El número de licencia es obligatorio.";
  }

  if (!driver.tipoLicencia) {
    return "El tipo de licencia es obligatorio.";
  }
  if (!["ITZAMNA", "MCCLICK", "AQUARIO", "ASPROMEX", "BALAM", "AGROKOOL"].includes(driver.empresa)) return "Selecciona una empresa válida.";

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      driver.licenciaVencimiento
    )
  ) {
    return "La fecha de vencimiento no es válida.";
  }

  const expirationDate =
    new Date(
      `${driver.licenciaVencimiento}T23:59:59`
    );

  if (
    Number.isNaN(
      expirationDate.getTime()
    )
  ) {
    return "La fecha de vencimiento no es válida.";
  }

  return null;
}

export async function listAdminDriversController(
  request,
  response
) {
  try {
    const drivers =
      await listAdminDrivers({
        search:
          request.query.search,

        status:
          request.query.status
      });

    return response
      .status(200)
      .json({
        success: true,
        data: drivers
      });
  } catch (error) {
    console.error(
      "Error consultando conductores:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible consultar los conductores."
      });
  }
}

export async function createAdminDriverController(
  request,
  response
) {
  try {
    const driver =
      normalizeDriverInput(
        request.body
      );

    const validationError =
      validateDriverInput(driver);

    if (validationError) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            validationError
        });
    }

    const createdDriver =
      await createAdminDriver(
        driver
      );

    return response
      .status(201)
      .json({
        success: true,
        data: createdDriver,
        message:
          "Conductor creado correctamente."
      });
  } catch (error) {
    if (
      error.code ===
      "DRIVER_LICENSE_EXISTS"
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
      "Error creando conductor:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible crear el conductor."
      });
  }
}

export async function updateAdminDriverStatusController(
  request,
  response
) {
  try {
    const idConductor =
      Number(
        request.params.idConductor
      );

    const activo =
      request.body?.activo;

    if (
      !Number.isInteger(idConductor) ||
      idConductor <= 0
    ) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del conductor no es válido."
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

    const updatedDriver =
      await updateAdminDriverStatus({
        idConductor,
        activo
      });

    if (!updatedDriver) {
      return response
        .status(404)
        .json({
          success: false,
          message:
            "No se encontró el conductor."
        });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: updatedDriver,
        message:
          "Conductor y su usuario de Telegram eliminados. El historial de viajes se conserva."
      });
  } catch (error) {
    if (["TRIP_IN_PROGRESS", "DRIVER_DELETED"].includes(error.code)) {
      return response.status(409).json({ success: false, message: error.message });
    }
    console.error(
      "Error actualizando conductor:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible actualizar el conductor."
      });
  }
}

export async function approveAdminDriverController(request, response) {
  try {
    const idConductor = Number(request.params.idConductor);
    const { aprobado } = request.body || {};

    if (!Number.isInteger(idConductor) || idConductor <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del conductor no es válido."
      });
    }

    const updated = await approveAdminDriver({
      idConductor,
      aprobado: Boolean(aprobado)
    });

    if (!updated) {
      return response.status(404).json({
        success: false,
        message: "Conductor no encontrado."
      });
    }

    return response.status(200).json({
      success: true,
      message: aprobado ? "Conductor aprobado correctamente." : "Conductor rechazado.",
      data: updated
    });
  } catch (error) {
    console.error("Error en approveAdminDriverController:", error);
    return response.status(500).json({
      success: false,
      message: "Ocurrió un error al procesar la aprobación del conductor."
    });
  }
}

export async function setDriverPinAdminController(request, response) {
  try {
    const idConductor = Number(request.params.idConductor);
    const { pin } = request.body || {};

    if (!Number.isInteger(idConductor) || idConductor <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del conductor no es válido."
      });
    }

    if (!pin || !/^\d{4}$/.test(String(pin).trim())) {
      return response.status(400).json({
        success: false,
        message: "El PIN debe ser un código de 4 dígitos numéricos."
      });
    }

    const updated = await setDriverPin({
      idConductor,
      pin: String(pin).trim()
    });

    return response.status(200).json({
      success: true,
      message: "PIN del conductor actualizado correctamente.",
      data: updated
    });
  } catch (error) {
    console.error("Error en setDriverPinAdminController:", error);
    return response.status(500).json({
      success: false,
      message: error.message || "Ocurrió un error al actualizar el PIN del conductor."
    });
  }
}

export async function assignAdminConductorVehicleController(request, response) {
  try {
    const idConductor = Number(request.params.idConductor);
    const idVehiculo = request.body?.idVehiculo ? Number(request.body.idVehiculo) : null;

    if (!Number.isInteger(idConductor) || idConductor <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del conductor no es válido."
      });
    }

    const result = await assignVehicleToDriver({ idConductor, idVehiculo });
    return response.status(200).json({
      success: true,
      data: result,
      message: idVehiculo ? "Vehículo asignado correctamente al conductor." : "Asignación vehicular removida."
    });
  } catch (error) {
    console.error("Error en asignación vehicular:", error.message);
    return response.status(500).json({
      success: false,
      message: "No fue posible realizar la asignación vehicular."
    });
  }
}



