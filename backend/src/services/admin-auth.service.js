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
            id_usuarios_admin,
            nombre,
            username,
            correo,
            password_hash,
            rol,
            activo,
            intentos_fallidos,
            bloqueado_hasta,
            ultimo_acceso_en
          FROM usuarios_admin
          WHERE LOWER(username) = $1
          LIMIT 1
          FOR UPDATE
        `,
        [normalizedUsername]
      );

    const user =
      userResult.rows[0];

    /*
     * No revelamos si el username existe.
     */
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

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      const failedAttempts =
        Number(user.intentos_fallidos || 0) + 1;

      const maximumAttempts =
        getMaximumAttempts();

      const shouldBlock =
        failedAttempts >= maximumAttempts;

      const blockMinutes =
        getBlockMinutes();

      await client.query(
        `
          UPDATE usuarios_admin
          SET
            intentos_fallidos = $1,
            bloqueado_hasta =
              CASE
                WHEN $2::boolean = TRUE
                THEN CURRENT_TIMESTAMP +
                     ($3 * INTERVAL '1 minute')
                ELSE NULL
              END,
            actualizado_en =
              CURRENT_TIMESTAMP
          WHERE id_usuarios_admin = $4
        `,
        [
          shouldBlock
            ? 0
            : failedAttempts,
          shouldBlock,
          blockMinutes,
          user.id_usuarios_admin
        ]
      );

      await client.query("COMMIT");

      return {
        authenticated: false,
        reason: shouldBlock
          ? "BLOCKED"
          : "INVALID_CREDENTIALS"
      };
    }

    const updateResult =
      await client.query(
        `
          UPDATE usuarios_admin
          SET
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            ultimo_acceso_en =
              CURRENT_TIMESTAMP,
            actualizado_en =
              CURRENT_TIMESTAMP
          WHERE id_usuarios_admin = $1
          RETURNING
            id_usuarios_admin,
            nombre,
            username,
            correo,
            rol,
            activo,
            ultimo_acceso_en
        `,
        [user.id_usuarios_admin]
      );

    await client.query("COMMIT");

    return {
      authenticated: true,
      user: updateResult.rows[0]
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
          id_usuarios_admin,
          nombre,
          username,
          correo,
          rol,
          activo,
          ultimo_acceso_en
        FROM usuarios_admin
        WHERE id_usuarios_admin = $1
          AND activo = TRUE
        LIMIT 1
      `,
      [adminUserId]
    );

  return result.rows[0] ?? null;
}