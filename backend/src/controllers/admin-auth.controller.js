import {
  authenticateAdminUser
} from "../services/admin-auth.service.js";

import {
  createAdminSessionToken,
  getAdminCookieName,
  getAdminCookieOptions
} from "../utils/admin-session.js";

function serializeAdminUser(user) {
  return {
    idUsuarioAdmin:
      user.id_usuarios_admin,

    nombre:
      user.nombre,

    username:
      user.username,

    correo:
      user.correo,

    rol:
      user.rol,

    activo:
      user.activo,

    ultimoAccesoEn:
      user.ultimo_acceso_en
  };
}

export async function loginAdminController(
  request,
  response
) {
  try {
    const username =
      String(
        request.body?.username || ""
      ).trim();

    const password =
      String(
        request.body?.password || ""
      );

    if (!username || !password) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "Usuario y contraseña son obligatorios."
        });
    }

    const result =
      await authenticateAdminUser({
        username,
        password
      });

    if (!result.authenticated) {
      if (
        result.reason === "BLOCKED"
      ) {
        return response
          .status(429)
          .json({
            success: false,
            message:
              "La cuenta está temporalmente bloqueada por múltiples intentos fallidos."
          });
      }

      if (
        result.reason === "INACTIVE"
      ) {
        return response
          .status(403)
          .json({
            success: false,
            message:
              "La cuenta administrativa está desactivada."
          });
      }

      return response
        .status(401)
        .json({
          success: false,
          message:
            "Usuario o contraseña incorrectos."
        });
    }

    const token =
      createAdminSessionToken(
        result.user
      );

    response.cookie(
      getAdminCookieName(),
      token,
      getAdminCookieOptions()
    );

    return response
      .status(200)
      .json({
        success: true,
        data: {
          authenticated: true,
          user:
            serializeAdminUser(
              result.user
            )
        }
      });
  } catch (error) {
    console.error(
      "Error iniciando sesión administrativa:",
      error.message
    );

    return response
      .status(500)
      .json({
        success: false,
        message:
          "No fue posible iniciar sesión."
      });
  }
}

export function logoutAdminController(
  request,
  response
) {
  response.clearCookie(
    getAdminCookieName(),
    {
      ...getAdminCookieOptions(),
      maxAge: undefined
    }
  );

  return response
    .status(200)
    .json({
      success: true,
      message:
        "Sesión cerrada correctamente."
    });
}

export function getAdminSessionController(
  request,
  response
) {
  return response
    .status(200)
    .json({
      success: true,
      data: {
        authenticated: true,
        user:
          serializeAdminUser(
            request.adminUser
          )
      }
    });
}