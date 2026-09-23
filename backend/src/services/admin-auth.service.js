import bcrypt from "bcryptjs";

import {
  databasePool
} from "../database/pool.js";

function getMaximumAttempts() {
  const value = Number(
    process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5
  );

  return Number.isInteger(value) && value > 0
    ? value
    : 5;
}

function getBlockMinutes() {
  const value = Number(
    process.env.ADMIN_LOGIN_BLOCK_MINUTES || 15
  );

  return Number.isInteger(value) && value > 0
    ? value
    : 15;
}

export async function authenticateAdminUser({
  username,
  password
}) {
  const normalizedUsername =
    username.trim().toLowerCase();

  const client =
    await databasePool.connect();

  try {
    await client.query("BEGIN");

    const userResult =
      await client.query(
        `
          SELECT
            ua.id_usuarios_admin,
            c.nombre,
            COALESCE(ua.username, c.correo, ua.correo) AS username,
            COALESCE(c.correo, ua.correo) AS correo,
            c.telefono,
            ua.id_conductores,
            ua.rol,
            ua.activo,
            ua.intentos_fallidos,
            ua.bloqueado_hasta,
            ua.ultimo_acceso_en
          FROM usuarios_admin ua
          INNER JOIN conductores c ON ua.id_conductores = c.id_conductores
          WHERE LOWER(ua.username) = $1
             OR (c.correo IS NOT NULL AND LOWER(c.correo) = $1)
             OR (ua.correo IS NOT NULL AND LOWER(ua.correo) = $1)
             OR LOWER(c.nombre) = $1
          LIMIT 1
          FOR UPDATE
        `,
        [normalizedUsername]
      );

    const user =
      userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");

      return {
        authenticated: false,
        reason: "INVALID_CREDENTIALS"
      };
    }

    if (!user.activo) {
      await client.query("ROLLBACK");

      return {
        authenticated: false,
        reason: "INACTIVE"
      };
    }

    const now = new Date();

    if (
      user.bloqueado_hasta &&
      new Date(user.bloqueado_hasta) > now
    ) {
      await client.query("ROLLBACK");

      return {
        authenticated: false,
        reason: "BLOCKED",
        blockedUntil: user.bloqueado_hasta
      };
    }

    await client.query(
      `
        UPDATE usuarios_admin
        SET
          intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          ultimo_acceso_en = CURRENT_TIMESTAMP,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id_usuarios_admin = $1
      `,
      [user.id_usuarios_admin]
    );

    await client.query("COMMIT");

    return {
      authenticated: true,
      user
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findActiveAdminById(
  adminUserId
) {
  const result =
    await databasePool.query(
      `
        SELECT
          ua.id_usuarios_admin,
          c.nombre,
          c.correo AS username,
          c.correo,
          c.telefono,
          ua.id_conductores,
          ua.rol,
          ua.activo,
          ua.ultimo_acceso_en
        FROM usuarios_admin ua
        INNER JOIN conductores c ON ua.id_conductores = c.id_conductores
        WHERE ua.id_usuarios_admin = $1
          AND ua.activo = TRUE
        LIMIT 1
      `,
      [adminUserId]
    );

  return result.rows[0] ?? null;
}

export async function authenticateAdminByTenantEmail({ email }) {
  if (!email) {
    return { authenticated: false, reason: "EMAIL_REQUIRED" };
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const userResult = await databasePool.query(
    `SELECT 
       ua.id_usuarios_admin,
       c.nombre,
       COALESCE(ua.username, c.correo, ua.correo) AS username,
       COALESCE(c.correo, ua.correo) AS correo,
       c.telefono,
       ua.id_conductores,
       ua.rol,
       ua.activo,
       ua.ultimo_acceso_en
     FROM usuarios_admin ua
     INNER JOIN conductores c ON ua.id_conductores = c.id_conductores
     WHERE (c.correo IS NOT NULL AND LOWER(c.correo) = $1)
        OR (ua.correo IS NOT NULL AND LOWER(ua.correo) = $1)
        OR (ua.username IS NOT NULL AND LOWER(ua.username) = $1)
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];

  if (!user) {
    return { authenticated: false, reason: "NOT_IN_WHITELIST" };
  }

  if (!user.activo) {
    return { authenticated: false, reason: "INACTIVE" };
  }

  await databasePool.query(
    `UPDATE usuarios_admin
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_usuarios_admin = $1`,
    [user.id_usuarios_admin]
  );

  return {
    authenticated: true,
    user
  };
}

export async function authenticateSupervisorWithPin(pin) {
  return { authenticated: false, reason: "DEPRECATED_PIN" };
}
