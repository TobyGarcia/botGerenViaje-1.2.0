import jwt from "jsonwebtoken";
import { createHmac } from "node:crypto";

export function mexicoClock(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
}

function key() {
  const secret = process.env.DRIVER_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("Falta configurar la clave de permisos sin conexión.");
  // Domain separation: these signatures cannot be used as driver/admin sessions.
  return createHmac("sha256", secret).update("gv-offline-trip-permit-v1").digest();
}

export function signOfflinePermit(claims, now = new Date()) {
  return jwt.sign({ ...claims, iat: Math.floor(+now / 1000) }, key(), {
    algorithm: "HS256", issuer: "gv-offline", audience: "offline-trip"
  });
}

export function verifyOfflinePermit(token, driverId, startedAt, now = new Date()) {
  let claims;
  try {
    // Expiry applies to recorded departure, not to the later upload time.
    claims = jwt.verify(token, key(), { algorithms: ["HS256"], issuer: "gv-offline", audience: "offline-trip", ignoreExpiration: true });
  } catch { throw new Error("El permiso sin conexión no es válido."); }
  const start = new Date(startedAt);
  if (!Number.isFinite(+start) || +start > +now + 60000 || +now - +start > 7 * 86400000 ||
      +start < claims.iat * 1000 || +start >= claims.exp * 1000 ||
      Number(claims.driverId) !== Number(driverId)) {
    throw new Error("El permiso no corresponde al conductor o a la hora de inicio.");
  }
  const clock = mexicoClock(start);
  if (clock.day !== claims.day || clock.minutes < 360 || clock.minutes >= 1080) {
    throw new Error("El inicio sin conexión solo aplica a viajes urbanos del mismo día, de 06:00 a antes de las 18:00, hora de México.");
  }
  return claims;
}
