import bcrypt from "bcryptjs";
import { databasePool } from "../database/pool.js";
import { isPinInUse } from "./driver-auth.service.js";

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

export function validAdminRole(rol) {
  return roles.has(String(rol || "").toUpperCase());
}

export async function listAdminUsers() {
  const result = await databasePool.query(`
    SELECT 
      ua.id_usuarios_admin,
      c.nombre,
      c.correo AS username,
      c.correo,
      c.telefono,
      ua.rol,
      ua.activo,
      ua.id_conductores,
      ua.ultimo_acceso_en
    FROM usuarios_admin ua
    INNER JOIN conductores c ON c.id_conductores = ua.id_conductores
    ORDER BY ua.activo DESC, c.nombre ASC`);
  return result.rows;
}

export async function registerPublicUser({ nombre, username, correo, telefono, rol }) {
  const cleanEmail = String(correo || "").trim().toLowerCase();
  const cleanName = String(nombre || "").trim();
  const userRol = validAdminRole(rol) ? String(rol).toUpperCase() : "SUPERVISOR";

  if (!cleanName) throw new Error("El nombre completo es requerido.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Un correo corporativo válido es requerido.");

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    // 1. Crear o actualizar el registro en conductores
    const condResult = await client.query(
      `INSERT INTO conductores (nombre, correo, telefono, activo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (LOWER(correo)) WHERE correo IS NOT NULL AND correo != ''
       DO UPDATE SET nombre = EXCLUDED.nombre, telefono = COALESCE(EXCLUDED.telefono, conductores.telefono), actualizado_en = CURRENT_TIMESTAMP
       RETURNING id_conductores, nombre, correo, telefono`,
      [cleanName, cleanEmail, telefono || null]
    );

    const conductorId = condResult.rows[0].id_conductores;

    // 2. Insertar o actualizar en usuarios_admin
    const adminResult = await client.query(
      `INSERT INTO usuarios_admin (id_conductores, rol, activo)
       VALUES ($1, $2, true)
       ON CONFLICT (id_conductores) DO UPDATE SET rol = EXCLUDED.rol, activo = true, actualizado_en = CURRENT_TIMESTAMP
       RETURNING id_usuarios_admin, id_conductores, rol, activo`,
      [conductorId, userRol]
    );

    await client.query("COMMIT");

    return {
      id_usuarios_admin: adminResult.rows[0].id_usuarios_admin,
      id_conductores: conductorId,
      nombre: condResult.rows[0].nombre,
      username: cleanEmail,
      correo: cleanEmail,
      telefono: condResult.rows[0].telefono,
      rol: adminResult.rows[0].rol,
      activo: adminResult.rows[0].activo
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createAdminUser(data) {
  const cleanEmail = String(data.correo || "").trim().toLowerCase();
  const cleanName = String(data.nombre || "").trim();
  const userRol = validAdminRole(data.rol) ? String(data.rol).toUpperCase() : "SUPERVISOR";

  if (!cleanName) throw new Error("El nombre es obligatorio.");
  if (!cleanEmail) throw new Error("El correo corporativo es obligatorio.");

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    let conductorId = data.idConductor ? Number(data.idConductor) : null;

    if (!conductorId) {
      const condResult = await client.query(
        `INSERT INTO conductores (nombre, correo, telefono, activo)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (LOWER(correo)) WHERE correo IS NOT NULL AND correo != ''
         DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id_conductores`,
        [cleanName, cleanEmail, data.telefono || null]
      );
      conductorId = condResult.rows[0].id_conductores;
    }

    const adminResult = await client.query(
      `INSERT INTO usuarios_admin (id_conductores, rol, activo)
       VALUES ($1, $2, true)
       RETURNING id_usuarios_admin, id_conductores, rol, activo`,
      [conductorId, userRol]
    );

    await client.query("COMMIT");

    return {
      id_usuarios_admin: adminResult.rows[0].id_usuarios_admin,
      id_conductores: conductorId,
      nombre: cleanName,
      username: cleanEmail,
      correo: cleanEmail,
      rol: adminResult.rows[0].rol,
      activo: adminResult.rows[0].activo
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAdminUser(id, data) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtener id_conductores actual
    const currentRes = await client.query(
      `SELECT id_conductores FROM usuarios_admin WHERE id_usuarios_admin = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const conductorId = currentRes.rows[0].id_conductores;

    // 2. Actualizar datos en conductores
    if (data.nombre || data.correo) {
      await client.query(
        `UPDATE conductores
         SET nombre = COALESCE($1, nombre),
             correo = COALESCE($2, correo),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_conductores = $3`,
        [data.nombre || null, data.correo ? String(data.correo).trim().toLowerCase() : null, conductorId]
      );
    }

    // 3. Actualizar usuarios_admin
    const result = await client.query(
      `UPDATE usuarios_admin 
       SET rol = $1, activo = $2, actualizado_en = CURRENT_TIMESTAMP 
       WHERE id_usuarios_admin = $3
       RETURNING id_usuarios_admin, id_conductores, rol, activo`,
      [data.rol, data.activo, id]
    );

    await client.query("COMMIT");

    return {
      id_usuarios_admin: result.rows[0].id_usuarios_admin,
      id_conductores: conductorId,
      nombre: data.nombre,
      correo: data.correo,
      rol: result.rows[0].rol,
      activo: result.rows[0].activo
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteAdminUser(id) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE gerenciamiento_viajes SET id_usuario_autorizador = NULL WHERE id_usuario_autorizador = $1`, [id]);
    await client.query(`UPDATE inspecciones_vehiculares SET id_usuario_admin_aprobador = NULL WHERE id_usuario_admin_aprobador = $1`, [id]);
    await client.query(`UPDATE inspecciones_vehiculares SET id_usuario_autorizador = NULL WHERE id_usuario_autorizador = $1`, [id]);

    await client.query("SAVEPOINT sp_opcionales_admin_del");
    try {
      await client.query(`UPDATE autorizaciones_manejo_comentado_viaje SET id_usuario_autorizador = NULL WHERE id_usuario_autorizador = $1`, [id]);
      await client.query("RELEASE SAVEPOINT sp_opcionales_admin_del");
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT sp_opcionales_admin_del");
    }

    const result = await client.query("DELETE FROM usuarios_admin WHERE id_usuarios_admin=$1 RETURNING id_usuarios_admin", [id]);
    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateOwnProfile(id, data) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    const currentRes = await client.query(
      `SELECT id_conductores FROM usuarios_admin WHERE id_usuarios_admin = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const conductorId = currentRes.rows[0].id_conductores;

    await client.query(
      `UPDATE conductores 
       SET nombre = COALESCE($1, nombre), 
           correo = COALESCE($2, correo), 
           telefono = COALESCE($3, telefono), 
           actualizado_en = CURRENT_TIMESTAMP 
       WHERE id_conductores = $4`,
      [data.nombre || null, data.correo ? String(data.correo).trim().toLowerCase() : null, data.telefono || null, conductorId]
    );

    await client.query("COMMIT");

    const fullRes = await databasePool.query(
      `SELECT ua.id_usuarios_admin, c.nombre, c.correo AS username, c.correo, c.telefono, ua.rol, ua.activo, ua.id_conductores, ua.ultimo_acceso_en
       FROM usuarios_admin ua
       INNER JOIN conductores c ON c.id_conductores = ua.id_conductores
       WHERE ua.id_usuarios_admin = $1`,
      [id]
    );

    return fullRes.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function assignAdminUserPin(id, pin) {
  const cleanPin = String(pin).trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error("El PIN debe ser un código numérico de 4 dígitos.");
  }

  const adminRes = await databasePool.query(
    `SELECT id_conductores FROM usuarios_admin WHERE id_usuarios_admin = $1`,
    [id]
  );
  if (adminRes.rowCount === 0) {
    return null;
  }
  const conductorId = adminRes.rows[0].id_conductores;

  const inUseCheck = await isPinInUse(cleanPin, conductorId);
  if (inUseCheck.inUse) {
    const error = new Error(`El PIN ya está en uso por otro usuario (${inUseCheck.conductor.nombre}). Elige un PIN diferente.`);
    error.code = "PIN_ALREADY_IN_USE";
    error.status = 409;
    throw error;
  }

  const pinHash = await bcrypt.hash(cleanPin, 10);
  const result = await databasePool.query(
    `UPDATE conductores c
     SET pin_hash = $1, actualizado_en = CURRENT_TIMESTAMP
     FROM usuarios_admin ua
     WHERE ua.id_conductores = c.id_conductores
       AND ua.id_usuarios_admin = $2
     RETURNING c.id_conductores, c.nombre`,
    [pinHash, id]
  );
  return result.rows[0] ?? null;
}
