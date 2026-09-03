import {
  findActiveAdminById
} from "../services/admin-auth.service.js";

import {
  getAdminCookieName,
  verifyAdminSessionToken
} from "../utils/admin-session.js";

export async function requireAdminSession(
  request,
  response,
  next
) {
  try {
    const cookieName =
      getAdminCookieName();

    const token =
      request.cookies?.[cookieName];

    if (!token) {
      return response
        .status(401)
        .json({
          success: false,
          message:
            "Sesión administrativa requerida."
        });
    }

    const payload =
      verifyAdminSessionToken(token);

    const adminUser =
      await findActiveAdminById(
        Number(payload.sub)
      );

    if (!adminUser) {
      return response
        .status(401)
        .json({
          success: false,
          message:
            "La sesión ya no es válida."
        });
    }

    request.adminUser =
      adminUser;

    return next();
  } catch (error) {
    return response
      .status(401)
      .json({
        success: false,
        message:
          "La sesión es inválida o expiró."
      });
  }
}

export const ROLES_SUPERVISOR_Y_SUPERIOR = [
  "ADMINISTRADOR",
  "GERENTE",
  "GERENTE_GENERAL",
  "COORDINADOR",
  "COORDINADOR_AREA",
  "COORDINADOR_QHSE",
  "SUPERVISOR",
  "QHSE",
  "INSTRUCTOR"
];

export const ROLES_TODOS_OPERATIVOS = [
  ...ROLES_SUPERVISOR_Y_SUPERIOR,
  "OPERADOR",
  "CONSULTA"
];

/** Restricción de autorización centralizada. La interfaz oculta acciones,
 * pero el servidor siempre conserva la última palabra. */
export function requireAdminRoles(...roles) {
  const allowedRoles = new Set(roles.flat());

  return (request, response, next) => {
    if (!allowedRoles.has(request.adminUser?.rol)) {
      return response.status(403).json({
        success: false,
        message: "Tu rol no tiene permiso para realizar esta acción."
      });
    }
    return next();
  };
}

