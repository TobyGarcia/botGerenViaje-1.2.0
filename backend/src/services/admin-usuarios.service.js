import bcrypt from "bcryptjs";
import { databasePool } from "../database/pool.js";

const roles = new Set(["ADMINISTRADOR", "SUPERVISOR", "COORDINADOR", "GERENTE", "QHSE", "OPERADOR", "CONSULTA"]);
export function validAdminRole(rol) { return roles.has(String(rol || "").toUpperCase()); }

export async function listAdminUsers() {
  const result = await databasePool.query(`
    SELECT ua.id_usuarios_admin, ua.nombre, ua.username, ua.correo, ua.telefono,
      ua.contacto_emergencia, ua.avatar_url, ua.rol, ua.activo, ua.id_conductores,
      ua.ultimo_acceso_en, c.nombre AS conductor
    FROM usuarios_admin ua
    LEFT JOIN conductores c ON c.id_conductores = ua.id_conductores
    ORDER BY ua.activo DESC, ua.nombre ASC`);
  return result.rows;
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
