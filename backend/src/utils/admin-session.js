import jwt from "jsonwebtoken";

export function getAdminCookieName() {
  return (
    process.env.ADMIN_COOKIE_NAME ||
    "admin_session"
  );
}

export function getAdminCookieOptions() {
  const secure =
    String(
      process.env.ADMIN_COOKIE_SECURE
    ).toLowerCase() === "true";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge:
      8 * 60 * 60 * 1000
  };
}

export function createAdminSessionToken(
  adminUser
) {
  const secret =
    process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_JWT_SECRET no está configurado."
    );
  }

  return jwt.sign(
    {
      sub: String(
        adminUser.id_usuarios_admin
      ),

      username:
        adminUser.username,

      role:
        adminUser.rol,

      type:
        "ADMIN_SESSION"
    },
    secret,
    {
      expiresIn:
        process.env
          .ADMIN_JWT_EXPIRES_IN ||
        "8h",

      issuer:
        "gerenciamiento-viajes",

      audience:
        "panel-admin"
    }
  );
}

export function verifyAdminSessionToken(
  token
) {
  const secret =
    process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_JWT_SECRET no está configurado."
    );
  }

  const payload =
    jwt.verify(
      token,
      secret,
      {
        issuer:
          "gerenciamiento-viajes",

        audience:
          "panel-admin"
      }
    );

  if (
    payload.type !==
    "ADMIN_SESSION"
  ) {
    throw new Error(
      "Tipo de sesión no válido."
    );
  }

  return payload;
}