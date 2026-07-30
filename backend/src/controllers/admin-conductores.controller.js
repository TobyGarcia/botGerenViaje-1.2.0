import {
  createAdminDriver,
  listAdminDrivers,
  updateAdminDriverStatus
} from "../services/admin-conductores.service.js";

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

    licenciaVencimiento:
      String(
        body?.licenciaVencimiento || ""
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
          activo
            ? "Conductor reactivado correctamente."
            : "Conductor dado de baja correctamente."
      });
  } catch (error) {
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