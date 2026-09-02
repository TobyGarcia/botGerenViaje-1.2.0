import { authenticateDriverWithPin } from "../services/driver-auth.service.js";
import { getDriverCookieName, getDriverCookieOptions } from "../utils/driver-session.js";

export async function loginDriverWithPinController(request, response) {
  try {
    const { idConductor, pin } = request.body || {};

    if (!idConductor || !pin) {
      return response.status(400).json({
        success: false,
        message: "El conductor y el PIN son obligatorios."
      });
    }

    const authResult = await authenticateDriverWithPin({
      idConductor: Number(idConductor),
      pin
    });

    if (!authResult.authenticated) {
      const messages = {
        MISSING_FIELDS: "Todos los campos son obligatorios.",
        INVALID_PIN_FORMAT: "El PIN debe constar de 4 dígitos numéricos.",
        CONDUCTOR_NOT_FOUND: "Conductor no encontrado.",
        CONDUCTOR_INACTIVE: "Tu cuenta de conductor está inactiva.",
        PENDING_APPROVAL: "Tu cuenta está pendiente de aprobación por el administrador.",
        PIN_NOT_SET: "Este conductor no tiene un PIN configurado. Contacta al administrador.",
        INVALID_PIN: "PIN incorrecto. Verifica e intenta de nuevo."
      };

      const statusCode = authResult.reason === "PENDING_APPROVAL" ? 403 : 401;

      return response.status(statusCode).json({
        success: false,
        message: messages[authResult.reason] || "No fue posible iniciar sesión con el PIN."
      });
    }

    response.cookie(getDriverCookieName(), authResult.token, getDriverCookieOptions());


    return response.status(200).json({
      success: true,
      message: "Inicio de sesión exitoso.",
      data: {
        token: authResult.token,
        conductor: authResult.conductor
      }
    });
  } catch (error) {
    console.error("Error en loginDriverWithPinController:", error);
    return response.status(500).json({
      success: false,
      message: "Ocurrió un error al procesar el inicio de sesión del conductor."
    });
  }
}
