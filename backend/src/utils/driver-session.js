import jwt from "jsonwebtoken";

export function getDriverCookieName() {
  return process.env.DRIVER_COOKIE_NAME || "driver_session";
}

export function createDriverSessionToken(conductor) {
  const secret = process.env.DRIVER_JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error("DRIVER_JWT_SECRET no está configurado.");
  }

  return jwt.sign(
    {
      sub: String(conductor.id_conductores),
      nombre: conductor.nombre,
      type: "DRIVER_SESSION"
    },
    secret,
    {
      expiresIn: process.env.DRIVER_JWT_EXPIRES_IN || "30d",
      issuer: "gerenciamiento-viajes",
      audience: "mini-app-conductor"
    }
  );
}

export function verifyDriverSessionToken(token) {
  const secret = process.env.DRIVER_JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error("DRIVER_JWT_SECRET no está configurado.");
  }

  const payload = jwt.verify(token, secret, {
    issuer: "gerenciamiento-viajes",
    audience: "mini-app-conductor"
  });

  if (payload.type !== "DRIVER_SESSION") {
    throw new Error("Tipo de sesión no válido.");
  }

  return payload;
}
