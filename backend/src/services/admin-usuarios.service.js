import bcrypt from "bcryptjs";
import { databasePool } from "../database/pool.js";

const roles = new Set([
  "ADMINISTRADOR",
  "GERENTE",
  "GERENTE_GENERAL",
  "COORDINADOR",
  "COORDINADOR_AREA",
  "COORDINADOR_QHSE",
  "SUPERVISOR",
  "QHSE",
  "INSTRUCTOR",
  "OPERADOR",
  "CONSULTA"
]);
export function validAdminRole(rol) { return roles.has(String(rol || "").toUpperCase()); }

export async function listAdminUsers() {
  const result = await databasePool.query(`
    SELECT ua.id_usuarios_admin, ua.nombre, ua.username, ua.correo, ua.telefono,
      ua.contacto_emergencia, ua.avatar_url, ua.rol, ua.activo, ua.id_conductores,
      (ua.pin_hash IS NOT NULL) AS tiene_pin,
      ua.ultimo_acceso_en, c.nombre AS conductor
    FROM usuarios_admin ua
    LEFT JOIN conductores c ON c.id_conductores = ua.id_conductores
    ORDER BY ua.activo DESC, ua.nombre ASC`);
  return result.rows;
}

export async function assignAdminUserPin(id, pin) {
  const cleanPin = String(pin || "").trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error("El PIN debe constar exactamente de 4 dígitos numéricos.");
  }
  const pinHash = await bcrypt.hash(cleanPin, 10);
  const result = await databasePool.query(`
    UPDATE usuarios_admin
    SET pin_hash = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id_usuarios_admin = $2
    RETURNING id_usuarios_admin, nombre, username, correo, rol, activo, (pin_hash IS NOT NULL) AS tiene_pin`,
    [pinHash, id]
  );
  return result.rows[0] ?? null;
}

export async function registerPublicUser({ nombre, username, correo, telefono, rol }) {
  const cleanEmail = String(correo || "").trim().toLowerCase();
  const cleanName = String(nombre || "").trim();
  const cleanUsername = String(username || cleanEmail.split("@")[0] || "").trim().toLowerCase();
  const userRol = validAdminRole(rol) ? String(rol).toUpperCase() : "SUPERVISOR";

  if (!cleanName) throw new Error("El nombre completo es requerido.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Un correo corporativo válido es requerido.");

  const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

  const result = await databasePool.query(`
    INSERT INTO usuarios_admin (nombre, username, correo, telefono, password_hash, rol, activo)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (correo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      telefono = COALESCE(EXCLUDED.telefono, usuarios_admin.telefono),
      actualizado_en = CURRENT_TIMESTAMP
    RETURNING id_usuarios_admin, nombre, username, correo, telefono, rol, activo, (pin_hash IS NOT NULL) AS tiene_pin`,
    [cleanName, cleanUsername, cleanEmail, telefono || null, randomPassword, userRol]
  );

  return result.rows[0];
}

export async function createAdminUser(data) {
  const hash = await bcrypt.hash(data.password, 12);
  const result = await databasePool.query(`
    INSERT INTO usuarios_admin (nombre, username, correo, password_hash, rol, id_conductores)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_usuarios_admin, nombre, username, correo, rol, activo, id_conductores`,
    [data.nombre, data.username.toLowerCase(), data.correo || null, hash, data.rol, data.idConductor || null]);
  return result.rows[0];
}

export async function updateAdminUser(id, data) {
  const result = await databasePool.query(`
    UPDATE usuarios_admin SET nombre=$1, correo=$2, rol=$3, activo=$4, id_conductores=$5,
      actualizado_en=CURRENT_TIMESTAMP WHERE id_usuarios_admin=$6
    RETURNING id_usuarios_admin, nombre, username, correo, rol, activo, id_conductores`,
    [data.nombre, data.correo || null, data.rol, data.activo, data.idConductor || null, id]);
  return result.rows[0] ?? null;
}

export async function deleteAdminUser(id) {
  const result = await databasePool.query("DELETE FROM usuarios_admin WHERE id_usuarios_admin=$1 RETURNING id_usuarios_admin", [id]);
  return result.rows[0] ?? null;
}

export async function updateOwnProfile(id, data) {
  const result = await databasePool.query(`
    UPDATE usuarios_admin SET nombre=$1, correo=$2, telefono=$3, contacto_emergencia=$4, avatar_url=$5,
      actualizado_en=CURRENT_TIMESTAMP WHERE id_usuarios_admin=$6
    RETURNING id_usuarios_admin, nombre, username, correo, telefono, contacto_emergencia, avatar_url, rol, activo, id_conductores, ultimo_acceso_en`,
    [data.nombre, data.correo || null, data.telefono || null, data.contactoEmergencia || null, data.avatarUrl || null, id]);
  return result.rows[0] ?? null;
}
