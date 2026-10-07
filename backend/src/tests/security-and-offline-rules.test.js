import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  mexicoClock,
  signOfflinePermit,
  verifyOfflinePermit
} from "../utils/offline-trip-permit.js";
import {
  createAdminSessionToken,
  getAdminCookieOptions,
  verifyAdminSessionToken
} from "../utils/admin-session.js";

const ORIGINAL_ADMIN_SECRET = process.env.ADMIN_JWT_SECRET;
const ORIGINAL_DRIVER_SECRET = process.env.DRIVER_JWT_SECRET;
const ORIGINAL_ADMIN_EXPIRY = process.env.ADMIN_JWT_EXPIRES_IN;
const ORIGINAL_COOKIE_AGE = process.env.ADMIN_COOKIE_MAX_AGE_MS;

function restoreEnvironment() {
  const values = {
    ADMIN_JWT_SECRET: ORIGINAL_ADMIN_SECRET,
    DRIVER_JWT_SECRET: ORIGINAL_DRIVER_SECRET,
    ADMIN_JWT_EXPIRES_IN: ORIGINAL_ADMIN_EXPIRY,
    ADMIN_COOKIE_MAX_AGE_MS: ORIGINAL_COOKIE_AGE
  };
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

afterEach(restoreEnvironment);

function permitForDay() {
  process.env.DRIVER_JWT_SECRET = "offline-test-secret-with-enough-entropy";
  const issuedAt = new Date("2026-10-06T11:55:00.000Z"); // 05:55 en México
  const claims = {
    driverId: 7,
    vehicleId: 9,
    inspectionId: 11,
    day: "2026-10-06",
    exp: Math.floor(+new Date("2026-10-07T00:00:00.000Z") / 1000)
  };
  return signOfflinePermit(claims, issuedAt);
}

describe("Reglas de permisos sin conexión", () => {
  test("usa la hora de Ciudad de México", () => {
    assert.deepEqual(mexicoClock("2026-10-06T12:00:00.000Z"), {
      day: "2026-10-06",
      minutes: 360
    });
  });

  test("acepta exactamente a las 06:00 y hasta las 17:59", () => {
    const token = permitForDay();
    assert.equal(verifyOfflinePermit(token, 7, "2026-10-06T12:00:00.000Z", new Date("2026-10-06T12:01:00.000Z")).driverId, 7);
    assert.equal(verifyOfflinePermit(token, 7, "2026-10-06T23:59:00.000Z", new Date("2026-10-07T00:00:00.000Z")).vehicleId, 9);
  });

  test("rechaza antes de las 06:00, desde las 18:00 y a otro conductor", () => {
    const token = permitForDay();
    assert.throws(() => verifyOfflinePermit(token, 7, "2026-10-06T11:59:00.000Z", new Date("2026-10-06T12:01:00.000Z")));
    assert.throws(() => verifyOfflinePermit(token, 7, "2026-10-07T00:00:00.000Z", new Date("2026-10-07T00:01:00.000Z")));
    assert.throws(() => verifyOfflinePermit(token, 8, "2026-10-06T12:00:00.000Z", new Date("2026-10-06T12:01:00.000Z")));
  });

  test("rechaza un permiso alterado", () => {
    const token = permitForDay();
    const altered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.throws(() => verifyOfflinePermit(altered, 7, "2026-10-06T12:00:00.000Z", new Date("2026-10-06T12:01:00.000Z")), /no es válido/);
  });
});

describe("Sesión administrativa", () => {
  test("dura 45 minutos por defecto y la cookie coincide", () => {
    process.env.ADMIN_JWT_SECRET = "admin-test-secret-with-enough-entropy";
    delete process.env.ADMIN_JWT_EXPIRES_IN;
    delete process.env.ADMIN_COOKIE_MAX_AGE_MS;
    const token = createAdminSessionToken({ id_usuarios_admin: 5, username: "admin@example.com", rol: "ADMINISTRADOR" });
    const decoded = jwt.decode(token);
    assert.equal(decoded.exp - decoded.iat, 45 * 60);
    assert.equal(getAdminCookieOptions().maxAge, 45 * 60 * 1000);
    assert.equal(verifyAdminSessionToken(token).type, "ADMIN_SESSION");
  });

  test("rechaza tokens de otro tipo", () => {
    process.env.ADMIN_JWT_SECRET = "admin-test-secret-with-enough-entropy";
    const token = jwt.sign({ type: "DRIVER_SESSION" }, process.env.ADMIN_JWT_SECRET, {
      issuer: "gerenciamiento-viajes",
      audience: "panel-admin",
      expiresIn: "45m"
    });
    assert.throws(() => verifyAdminSessionToken(token), /Tipo de sesión no válido/);
  });
});
