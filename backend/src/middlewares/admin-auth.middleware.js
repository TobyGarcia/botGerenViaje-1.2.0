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