import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { databasePool } from "../database/pool.js";
import { validateTenantEmailAndWhitelist } from "./azure-auth.service.js";

const allowedDomains = ["itzamna.mx", "aspromex.mx"];

function requiresEmailConfirmation() {
  return String(process.env.SUPERVISOR_REQUIRE_EMAIL_CONFIRMATION) === "true";
}

export class SupervisorTelegramError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SupervisorTelegramError";
    this.statusCode = statusCode;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function registerSupervisorGroupMember({ telegramUser, groupId }) {
  await databasePool.query(`
    INSERT INTO accesos_supervisor_telegram (telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, telegram_group_id)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_username=EXCLUDED.telegram_username,
      telegram_first_name=EXCLUDED.telegram_first_name, telegram_last_name=EXCLUDED.telegram_last_name,
      telegram_group_id=EXCLUDED.telegram_group_id, habilitado_en=CURRENT_TIMESTAMP`,
    [
      String(telegramUser.id),
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      String(groupId)
    ]);
}

export async function getSupervisorAccess(telegramUserId) {
  const result = await databasePool.query(`
    SELECT
      a.telegram_user_id,
      ua.id_usuarios_admin,
      c.nombre,
      c.correo AS username,
      c.correo,
      ua.rol,
      ua.activo
    FROM accesos_supervisor_telegram a
    LEFT JOIN usuarios_admin ua ON ua.activo = TRUE
    LEFT JOIN conductores c ON c.id_conductores = ua.id_conductores
    WHERE a.telegram_user_id = $1
    LIMIT 1`, [String(telegramUserId)]);

  const row = result.rows[0];
  if (!row) return { invited: false, registered: false, confirmed: false, user: null };

  return {
    invited: true,
    registered: Boolean(row.id_usuarios_admin),
    confirmed: Boolean(row.id_usuarios_admin) && Boolean(row.activo),
    user: row.id_usuarios_admin ? row : null
  };
}

export async function linkSupervisorByTenantEmail({ telegramUserId, email, telegramUser }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new SupervisorTelegramError("El correo corporativo es obligatorio.");
  }

  const whitelistCheck = await validateTenantEmailAndWhitelist(normalizedEmail);
  if (!whitelistCheck.authorized) {
    throw new SupervisorTelegramError(whitelistCheck.reason || "El correo no está autorizado en la lista blanca.");
  }

  const user = whitelistCheck.user;

  const allowedRoles = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"];
  if (!allowedRoles.includes(user.rol)) {
    throw new SupervisorTelegramError("La cuenta registrada no tiene permisos de rol de supervisión o superior.", 403);
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    // Registrar en accesos_supervisor_telegram
    await client.query(
      `INSERT INTO accesos_supervisor_telegram (telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, habilitado_en)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         telegram_username = COALESCE(EXCLUDED.telegram_username, accesos_supervisor_telegram.telegram_username),
         telegram_first_name = COALESCE(EXCLUDED.telegram_first_name, accesos_supervisor_telegram.telegram_first_name),
         telegram_last_name = COALESCE(EXCLUDED.telegram_last_name, accesos_supervisor_telegram.telegram_last_name),
         habilitado_en = CURRENT_TIMESTAMP`,
      [
        String(telegramUserId),
        telegramUser?.username || null,
        telegramUser?.first_name || null,
        telegramUser?.last_name || null
      ]
    );

    await client.query("COMMIT");

    return {
      linked: true,
      confirmed: true,
      user: {
        id_usuarios_admin: user.id_usuarios_admin,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
