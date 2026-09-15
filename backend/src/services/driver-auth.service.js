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
         puesto,
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

    if (!conductor.pin_hash) {
      return { authenticated: false, reason: "PIN_NOT_SET" };
    }

    const matches = await bcrypt.compare(cleanPin, conductor.pin_hash);
    if (!matches) {
      return { authenticated: false, reason: "INVALID_PIN" };
    }

    if (!conductor.activo) {
      return { authenticated: false, reason: "CONDUCTOR_INACTIVE", conductor };
    }

    if (conductor.aprobado_por_admin === false) {
      return { authenticated: false, reason: "PENDING_APPROVAL", conductor };
    }
  } else {
    // Buscar entre todos los conductores que tienen PIN asignado
    const result = await databasePool.query(
      `SELECT 
         id_conductores,
         nombre,
         licencia_numero,
         tipo_licencia,
         empresa,
         puesto,
         licencia_vigente,
         licencia_vencimiento,
         telefono,
         activo,
         aprobado_por_admin,
         pin_hash
       FROM conductores
       WHERE pin_hash IS NOT NULL`
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

    if (!conductor.activo) {
      return { authenticated: false, reason: "CONDUCTOR_INACTIVE", conductor };
    }

    if (conductor.aprobado_por_admin === false) {
      return { authenticated: false, reason: "PENDING_APPROVAL", conductor };
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
      puesto: conductor.puesto,
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
       puesto,
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

export async function findDriverById(idConductor) {
  const result = await databasePool.query(
    `SELECT 
       id_conductores,
       nombre,
       licencia_numero,
       tipo_licencia,
       empresa,
       puesto,
       licencia_vigente,
       licencia_vencimiento,
       telefono,
       licencia_url,
       licencia_reverso_url,
       activo,
       aprobado_por_admin
     FROM conductores
     WHERE id_conductores = $1
     LIMIT 1`,
    [idConductor]
  );

  return result.rows[0] ?? null;
}

export async function updateDriverSelfProfile(idConductor, {
  telefono,
  licenciaNumero,
  tipoLicencia,
  puesto,
  licenciaVencimiento,
  licenciaUrl,
  licenciaReversoUrl
}) {
  const updates = [];
  const params = [idConductor];

  if (telefono !== undefined) {
    params.push(String(telefono).trim());
    updates.push(`telefono = $${params.length}`);
  }

  if (licenciaNumero !== undefined) {
    params.push(String(licenciaNumero).trim());
    updates.push(`licencia_numero = $${params.length}`);
  }

  if (tipoLicencia !== undefined) {
    params.push(String(tipoLicencia).trim());
    updates.push(`tipo_licencia = $${params.length}`);
  }

  if (puesto !== undefined) {
    params.push(puesto ? String(puesto).trim() : null);
    updates.push(`puesto = $${params.length}`);
  }

  if (licenciaVencimiento !== undefined && String(licenciaVencimiento).trim()) {
    const cleanDate = String(licenciaVencimiento).trim();
    params.push(cleanDate);
    updates.push(`licencia_vencimiento = $${params.length}::date`);
    updates.push(`licencia_vigente = ($${params.length}::date >= CURRENT_DATE)`);
  }

  if (licenciaUrl !== undefined && licenciaUrl !== null) {
    params.push(licenciaUrl);
    updates.push(`licencia_url = $${params.length}`);
  }

  if (licenciaReversoUrl !== undefined && licenciaReversoUrl !== null) {
    params.push(licenciaReversoUrl);
    updates.push(`licencia_reverso_url = $${params.length}`);
  }

  if (updates.length === 0) {
    return findDriverById(idConductor);
  }

  updates.push("actualizado_en = CURRENT_TIMESTAMP");

  const query = `
    UPDATE conductores
    SET ${updates.join(", ")}
    WHERE id_conductores = $1
    RETURNING 
      id_conductores,
      nombre,
      licencia_numero,
      tipo_licencia,
      empresa,
      puesto,
      licencia_vigente,
      licencia_vencimiento,
      telefono,
      licencia_url,
      licencia_reverso_url,
      activo,
      aprobado_por_admin
  `;

  const result = await databasePool.query(query, params);
  return result.rows[0] ?? null;
}

