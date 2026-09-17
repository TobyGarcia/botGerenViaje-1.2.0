import { crearReporteSiniestro, listarSiniestros } from "../services/siniestros.service.js";

export async function crearSiniestroController(request, response) {
  try {
    const idConductor = request.driverUser?.id_conductores;
    if (!idConductor) {
      return response.status(401).json({
        success: false,
        message: "No se encontró sesión de conductor válida."
      });
    }

    const {
      idVehiculo,
      tipoSiniestro,
      descripcion,
      latitud,
      longitud,
      altitud,
      fotos
    } = request.body || {};

    if (!tipoSiniestro || typeof tipoSiniestro !== "string" || !tipoSiniestro.trim()) {
      return response.status(400).json({
        success: false,
        message: "Selecciona el tipo de siniestro / incidente."
      });
    }

    const siniestro = await crearReporteSiniestro({
      idConductor,
      idVehiculo,
      tipoSiniestro,
      descripcion,
      latitud,
      longitud,
      altitud,
      fotos
    });

    return response.status(201).json({
      success: true,
      message: "¡Reporte de siniestro enviado con éxito! Se ha generado el documento PDF y emitido las alertas de emergencia.",
      data: {
        siniestro
      }
    });
  } catch (error) {
    console.error("Error al registrar siniestro:", error);
    return response.status(500).json({
      success: false,
      message: error.message || "No fue posible registrar el reporte de siniestro."
    });
  }
}

export async function listarSiniestrosController(request, response) {
  try {
    const limit = Number(request.query.limit || 50);
    const offset = Number(request.query.offset || 0);
    const siniestros = await listarSiniestros({ limit, offset });

    return response.status(200).json({
      success: true,
      data: { siniestros }
    });
  } catch (error) {
    console.error("Error al listar siniestros:", error);
    return response.status(500).json({
      success: false,
      message: "No se pudo obtener el historial de siniestros."
    });
  }
}
