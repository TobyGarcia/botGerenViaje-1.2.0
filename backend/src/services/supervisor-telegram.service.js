import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { databasePool } from "../database/pool.js";

const allowedDomains = ["itzamna.mx"];

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

function validateRegistration({ nombre, username, correo, telefono, password, confirmacionPassword }) {
  const email = normalizeEmail(correo);
  const domain = email.split("@")[1];
  if (!nombre?.trim() || nombre.trim().length > 150) throw new SupervisorTelegramError("El nombre es obligatorio.");
  if (!/^[a-z0-9][a-z0-9._-]{2,99}$/i.test(String(username || ""))) throw new SupervisorTelegramError("El usuario debe tener de 3 a 100 caracteres y usar solo letras, números, punto, guion o guion bajo.");
  if (!/^\S+@\S+\.\S+$/.test(email) || !allowedDomains.includes(domain)) throw new SupervisorTelegramError("Solo se autorizan correos con dominio @itzamna.mx durante esta etapa de pruebas.");
  if (!telefono?.trim() || telefono.trim().length > 30) throw new SupervisorTelegramError("El teléfono es obligatorio.");
  if (String(password || "").length < 10) throw new SupervisorTelegramError("La contraseña debe tener al menos 10 caracteres.");
  if (password !== confirmacionPassword) throw new SupervisorTelegramError("Las contraseñas no coinciden.");
  return { nombre: nombre.trim(), username: username.trim().toLowerCase(), correo: email, telefono: telefono.trim(), password };
}

export async function registerSupervisorGroupMember({ telegramUser, groupId }) {
  await databasePool.query(`
    INSERT INTO accesos_supervisor_telegram (telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, telegram_group_id)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_username=EXCLUDED.telegram_username,
      telegram_first_name=EXCLUDED.telegram_first_name, telegram_last_name=EXCLUDED.telegram_last_name,
      telegram_group_id=EXCLUDED.telegram_group_id, habilitado_en=CURRENT_TIMESTAMP`,
    [String(telegramUser.id), telegramUser.username, telegramUser.first_name, telegramUser.last_name, String(groupId)]);
}

export async function getSupervisorAccess(telegramUserId) {
  const result = await databasePool.query(`
    SELECT a.telegram_user_id, ua.id_usuarios_admin, ua.nombre, ua.username, ua.correo, ua.rol, ua.activo, ua.correo_confirmado_en
    FROM accesos_supervisor_telegram a
    LEFT JOIN usuarios_admin ua ON ua.telegram_user_id=a.telegram_user_id
    WHERE a.telegram_user_id=$1 LIMIT 1`, [String(telegramUserId)]);
  const row = result.rows[0];
  if (!row) return { invited: false, registered: false, confirmed: false, user: null };
  return { invited: true, registered: Boolean(row.id_usuarios_admin), confirmed: Boolean(row.correo_confirmado_en), user: row.id_usuarios_admin ? row : null };
}

export async function registerSupervisor({ telegramUserId, data }) {
  const input = validateRegistration(data);
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const invite = await client.query("SELECT telegram_user_id FROM accesos_supervisor_telegram WHERE telegram_user_id=$1 FOR UPDATE", [String(telegramUserId)]);
    if (!invite.rows[0]) throw new SupervisorTelegramError("Debes iniciar el registro desde el grupo de supervisores.", 403);
    const existing = await client.query("SELECT id_usuarios_admin, correo_confirmado_en FROM usuarios_admin WHERE telegram_user_id=$1 FOR UPDATE", [String(telegramUserId)]);
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { created: false, confirmationToken: null, confirmed: Boolean(existing.rows[0].correo_confirmado_en) };
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await client.query(`INSERT INTO usuarios_admin (nombre,username,correo,telefono,password_hash,rol,activo,telegram_user_id)
      VALUES ($1,$2,$3,$4,$5,'SUPERVISOR',TRUE,$6) RETURNING id_usuarios_admin,nombre,username,correo,rol`,
      [input.nombre, input.username, input.correo, input.telefono, passwordHash, String(telegramUserId)]);
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await client.query(`INSERT INTO confirmaciones_correo_supervisor (id_usuarios_admin,token_hash,expira_en)
      VALUES ($1,$2,CURRENT_TIMESTAMP + INTERVAL '24 hours')`, [user.rows[0].id_usuarios_admin, tokenHash]);
    await client.query("COMMIT");
    return { created: true, user: user.rows[0], confirmationToken: token, confirmed: false };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw new SupervisorTelegramError("El usuario o correo ya está registrado.", 409);
    throw error;
  } finally { client.release(); }
}

export async function sendSupervisorWelcomeEmail({ user, token }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.SUPERVISOR_EMAIL_CONFIRM_URL) {
    throw new SupervisorTelegramError("El correo no está configurado. Define SMTP_HOST, SMTP_FROM y SUPERVISOR_EMAIL_CONFIRM_URL.", 503);
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE) === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
  const url = `${process.env.SUPERVISOR_EMAIL_CONFIRM_URL}${process.env.SUPERVISOR_EMAIL_CONFIRM_URL.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  await transport.sendMail({ from: process.env.SMTP_FROM, to: user.correo, subject: "Bienvenido al sistema de supervisión de viajes", text: `Hola ${user.nombre}. Confirma tu correo para activar el acceso desde Telegram: ${url}` });
}

export async function confirmSupervisorEmail(token) {
  const tokenHash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const result = await databasePool.query(`UPDATE usuarios_admin ua SET correo_confirmado_en=CURRENT_TIMESTAMP, actualizado_en=CURRENT_TIMESTAMP
    FROM confirmaciones_correo_supervisor c WHERE c.id_usuarios_admin=ua.id_usuarios_admin AND c.token_hash=$1
      AND c.confirmado_en IS NULL AND c.expira_en>CURRENT_TIMESTAMP RETURNING ua.id_usuarios_admin`, [tokenHash]);
  if (!result.rows[0]) throw new SupervisorTelegramError("El enlace de confirmación no es válido o expiró.", 400);
  await databasePool.query("UPDATE confirmaciones_correo_supervisor SET confirmado_en=CURRENT_TIMESTAMP WHERE token_hash=$1", [tokenHash]);
}
