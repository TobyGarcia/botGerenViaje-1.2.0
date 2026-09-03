import bcrypt from "bcryptjs";
import { databasePool } from "../database/pool.js";
import { createDriverSessionToken } from "../utils/driver-session.js";

export async function authenticateDriverWithPin({ idConductor, pin }) {
  if (!pin) {
    return { authenticated: false, reason: "MISSING_FIELDS" };
  }

  const cleanPin = String(pin).trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { authenticated: false, reason: "INVALID_PIN_FORMAT" };
  }

  let conductor = null;

  if (idConductor) {
    const result = await databasePool.query(
      `SELECT 
         id_conductores,
         nombre,
         licencia_numero,
         tipo_licencia,
         empresa,
         licencia_vigente,
         licencia_vencimiento,
         telefono,
         activo,
         aprobado_por_admin,
         pin_hash
       FROM conductores
       WHERE id_conductores = $1
       LIMIT 1`,
      [idConductor]
    );
    conductor = result.rows[0];

    if (!conductor) {
      return { authenticated: false, reason: "CONDUCTOR_NOT_FOUND" };
    }

    if (!conductor.activo) {
      return { authenticated: false, reason: "CONDUCTOR_INACTIVE" };
    }

    if (conductor.aprobado_por_admin === false) {
      return { authenticated: false, reason: "PENDING_APPROVAL" };
    }

    if (!conductor.pin_hash) {
      return { authenticated: false, reason: "PIN_NOT_SET" };
    }

    const matches = await bcrypt.compare(cleanPin, conductor.pin_hash);
    if (!matches) {
      return { authenticated: false, reason: "INVALID_PIN" };
    }
  } else {
    // Buscar entre todos los conductores activos que tienen PIN asignado
    const result = await databasePool.query(
      `SELECT 
         id_conductores,
         nombre,
         licencia_numero,
         tipo_licencia,
         empresa,
         licencia_vigente,
         licencia_vencimiento,
         telefono,
         activo,
         aprobado_por_admin,
         pin_hash
       FROM conductores
       WHERE activo = TRUE 
         AND aprobado_por_admin IS NOT FALSE 
         AND pin_hash IS NOT NULL`
    );

    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(cleanPin, row.pin_hash);
      if (isMatch) {
        conductor = row;
        break;
      }
    }

    if (!conductor) {
      return { authenticated: false, reason: "INVALID_PIN" };
    }
  }

  const token = createDriverSessionToken(conductor);

  return {
    authenticated: true,
    token,
    conductor: {
      id_conductores: conductor.id_conductores,
      idConductor: conductor.id_conductores,
      nombre: conductor.nombre,
      licencia_numero: conductor.licencia_numero,
      licenciaNumero: conductor.licencia_numero,
      tipo_licencia: conductor.tipo_licencia,
      empresa: conductor.empresa,
      licencia_vigente: conductor.licencia_vigente,
      licencia_vencimiento: conductor.licencia_vencimiento,
      telefono: conductor.telefono,
      activo: conductor.activo,
      aprobado_por_admin: conductor.aprobado_por_admin
    }
  };
}

export async function setDriverPin({ idConductor, pin }) {
  const cleanPin = String(pin).trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error("El PIN debe ser un código numérico de 4 dígitos.");
  }

  const pinHash = await bcrypt.hash(cleanPin, 10);

  const result = await databasePool.query(
    `UPDATE conductores
     SET pin_hash = $1, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_conductores = $2
     RETURNING id_conductores, nombre`,
    [pinHash, idConductor]
  );

  if (result.rowCount === 0) {
    throw new Error("Conductor no encontrado.");
  }

  return result.rows[0];
}

export async function findActiveDriverById(idConductor) {
  const result = await databasePool.query(
    `SELECT 
       id_conductores,
       nombre,
       licencia_numero,
       tipo_licencia,
       empresa,
       licencia_vigente,
       licencia_vencimiento,
       telefono,
       activo,
       aprobado_por_admin
     FROM conductores
     WHERE id_conductores = $1 AND activo = TRUE
     LIMIT 1`,
    [idConductor]
  );

  return result.rows[0] ?? null;
}
