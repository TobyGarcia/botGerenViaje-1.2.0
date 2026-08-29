import { getAdminAnaliticaCombustible } from "../services/analitica-combustible.service.js";

export async function getAdminAnaliticaCombustibleController(request, response) {
  try {
    const idVehiculo = request.query.idVehiculo ? Number(request.query.idVehiculo) : null;
    const dateFrom = request.query.dateFrom ? String(request.query.dateFrom).trim() : null;
    const dateTo = request.query.dateTo ? String(request.query.dateTo).trim() : null;

    if (idVehiculo !== null && (!Number.isInteger(idVehiculo) || idVehiculo <= 0)) {
      return response.status(400).json({
        success: false,
        message: "El identificador del vehículo no es válido."
      });
    }

    if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      return response.status(400).json({
        success: false,
        message: "La fecha inicial (dateFrom) debe tener formato YYYY-MM-DD."
      });
    }

    if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return response.status(400).json({
        success: false,
        message: "La fecha final (dateTo) debe tener formato YYYY-MM-DD."
      });
    }

    const data = await getAdminAnaliticaCombustible({
      idVehiculo,
      dateFrom,
      dateTo
    });

    return response.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error consultando analítica de combustible:", error.message);
    return response.status(500).json({
      success: false,
      message: "No fue posible consultar la analítica de combustible."
    });
  }
}
