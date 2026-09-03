import { authenticateDriverWithPin, findActiveDriverById } from "../services/driver-auth.service.js";
import { getDriverCookieName, getDriverCookieOptions, verifyDriverSessionToken } from "../utils/driver-session.js";

export async function loginDriverWithPinController(request, response) {
  try {
    const { idConductor, pin } = request.body || {};

    if (!pin) {
      return response.status(400).json({
        success: false,
        message: "El PIN de 4 dígitos es obligatorio."
      });
    }

    const authResult = await authenticateDriverWithPin({
      idConductor: idConductor ? Number(idConductor) : null,
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

export async function getDriverSessionController(request, response) {
  try {
    const authHeader = request.get("Authorization");
    const cookieToken = request.cookies?.[getDriverCookieName()];

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      return response.status(401).json({
        success: false,
        message: "No hay sesión activa."
      });
    }

    const payload = verifyDriverSessionToken(token);
    const conductor = await findActiveDriverById(Number(payload.sub));

    if (!conductor) {
      return response.status(401).json({
        success: false,
        message: "Conductor no encontrado o inactivo."
      });
    }

    return response.status(200).json({
      success: true,
      data: {
        conductor: {
          id_conductores: conductor.id_conductores,
          idConductor: conductor.id_conductores,
          nombre: conductor.nombre,
          licencia_numero: conductor.licencia_numero,
          licenciaNumero: conductor.licencia_numero,
          tipo_licencia: conductor.tipo_licencia,
          empresa: conductor.empresa,
          licencia_vigente: conductor.licencia_vigente,
          licencia_vencimiento: conductor.licencia_vencimiento,
          telefono: conductor.telefono,
          activo: conductor.activo,
          aprobado_por_admin: conductor.aprobado_por_admin
        }
      }
    });
  } catch (error) {
    return response.status(401).json({
      success: false,
      message: "Sesión inválida o expirada."
    });
  }
}

export function logoutDriverController(request, response) {
  response.clearCookie(getDriverCookieName(), getDriverCookieOptions());
  return response.status(200).json({
    success: true,
    message: "Sesión cerrada correctamente."
  });
}

