import {
  getConductores,
  getEstadosViaje,
  getLugares,
  getVehiculos
} from "../services/catalogos.service.js";

export async function listConductores(
  request,
  response
) {
  try {
    const conductores = await getConductores();

    return response.status(200).json({
      success: true,
      data: conductores
    });
  } catch (error) {
    console.error(
      "Error consultando conductores:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar los conductores."
    });
  }
}

export async function listVehiculos(
  request,
  response
) {
  try {
    const vehiculos = await getVehiculos();

    return response.status(200).json({
      success: true,
      data: vehiculos
    });
  } catch (error) {
    console.error(
      "Error consultando vehículos:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar los vehículos."
    });
  }
}

export async function listLugares(
  request,
  response
) {
  try {
    const lugares = await getLugares();

    return response.status(200).json({
      success: true,
      data: lugares
    });
  } catch (error) {
    console.error(
      "Error consultando lugares:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar los lugares."
    });
  }
}

export async function listEstadosViaje(
  request,
  response
) {
  try {
    const estados = await getEstadosViaje();

    return response.status(200).json({
      success: true,
      data: estados
    });
  } catch (error) {
    console.error(
      "Error consultando estados:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "No fue posible consultar los estados del viaje."
    });
  }
}