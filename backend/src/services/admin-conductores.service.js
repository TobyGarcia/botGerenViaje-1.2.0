import bcrypt from "bcryptjs";
import {
  databasePool
} from "../database/pool.js";

export async function listAdminDrivers({
  search = "",
  status = "TODOS"
} = {}) {
  const normalizedSearch =
    String(search).trim();

  const normalizedStatus =
    String(status).toUpperCase();

  const values = [];
  const conditions = [];

  if (normalizedSearch) {
    values.push(
      `%${normalizedSearch}%`
    );

    conditions.push(`
      (
        c.nombre ILIKE $${values.length}
        OR c.licencia_numero ILIKE $${values.length}
        OR c.telefono ILIKE $${values.length}
      )
    `);
  }

  if (
    normalizedStatus === "ACTIVOS" ||
    normalizedStatus === "INACTIVOS"
  ) {
    values.push(
      normalizedStatus === "ACTIVOS"
    );

    conditions.push(
      `c.activo = $${values.length}`
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result =
    await databasePool.query(
      `
        SELECT
          c.id_conductores,
          c.nombre,
          c.empresa,
          c.telefono,
          c.licencia_numero,
          c.tipo_licencia,
          c.licencia_vencimiento,
          c.licencia_vigente,
          c.fecha_manejo_comentado,
          c.licencia_url,
          c.licencia_reverso_url,
          c.activo,
          c.aprobado_por_admin,
          (c.pin_hash IS NOT NULL) AS tiene_pin,

          ut.telegram_user_id,
          ut.telegram_username,
          ut.estado_registro,

          v.id_vehiculos AS id_vehiculo_asignado,
          v.nombre AS vehiculo_asignado_nombre,
          v.numero_economico AS vehiculo_asignado_numero_economico,
          v.placas AS vehiculo_asignado_placas,

          ua.id_usuarios_admin,
          ua.rol AS rol_administrativo,
          ua.username AS admin_username,
          ua.correo AS admin_correo,
          ua.activo AS admin_activo

        FROM conductores c

        LEFT JOIN usuarios_telegram ut
          ON ut.id_conductores =
             c.id_conductores

        LEFT JOIN vehiculos v
          ON v.id_conductor_asignado =
             c.id_conductores

        LEFT JOIN (
          SELECT DISTINCT ON (id_conductores)
            id_usuarios_admin,
            id_conductores,
            rol,
            username,
            correo,
            activo
          FROM usuarios_admin
          WHERE id_conductores IS NOT NULL
          ORDER BY id_conductores, activo DESC, id_usuarios_admin DESC
        ) ua ON ua.id_conductores = c.id_conductores

        ${whereClause}

        ORDER BY
          c.aprobado_por_admin ASC,
          c.activo DESC,
          c.nombre ASC
      `,
      values
    );

  return result.rows;
}

export async function approveAdminDriver({ idConductor, aprobado }) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    let generatedPin = null;
    if (Boolean(aprobado)) {
      const pinCheck = await client.query(
        `SELECT pin_hash FROM conductores WHERE id_conductores = $1`,
        [idConductor]
      );
      if (!pinCheck.rows[0] || !pinCheck.rows[0].pin_hash) {
        generatedPin = String(Math.floor(1000 + Math.random() * 9000));
        const pinHash = await bcrypt.hash(generatedPin, 10);
        await client.query(
          `UPDATE conductores SET pin_hash = $1 WHERE id_conductores = $2`,
          [pinHash, idConductor]
        );
      }
    }

    const result = await client.query(
      `UPDATE conductores
       SET aprobado_por_admin = $1, fecha_aprobacion = CURRENT_TIMESTAMP
       WHERE id_conductores = $2
       RETURNING id_conductores, nombre, aprobado_por_admin, (pin_hash IS NOT NULL) AS tiene_pin`,
      [Boolean(aprobado), idConductor]
    );

    const driver = result.rows[0];
    if (driver) {
      await client.query(
        `UPDATE usuarios_telegram
         SET estado_registro = CASE WHEN $1 = TRUE THEN 'COMPLETO' ELSE 'RECHAZADO' END
         WHERE id_conductores = $2`,
        [Boolean(aprobado), idConductor]
      );
    }

    await client.query("COMMIT");
    return { ...driver, pinGenerado: generatedPin };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function createAdminDriver({
  nombre,
  telefono,
  licenciaNumero,
  tipoLicencia,
  empresa,
  licenciaVencimiento,
  fechaManejoComentado,
  licenciaUrl,
  licenciaReversoUrl
}) {
  const expirationDate =
    new Date(
      `${licenciaVencimiento}T23:59:59`
    );

  const licenciaVigente =
    !Number.isNaN(
      expirationDate.getTime()
    ) &&
    expirationDate >= new Date();

  const client =
    await databasePool.connect();

  try {
    await client.query("BEGIN");

    const existingResult =
      await client.query(
        `
          SELECT
            id_conductores
          FROM conductores
          WHERE LOWER(licencia_numero) =
                LOWER($1)
          LIMIT 1
        `,
        [licenciaNumero]
      );

    if (existingResult.rows[0]) {
      const error =
        new Error(
          "Ya existe un conductor con ese número de licencia."
        );

      error.code =
        "DRIVER_LICENSE_EXISTS";

      throw error;
    }

    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await bcrypt.hash(generatedPin, 10);

    const result =
      await client.query(
        `
          INSERT INTO conductores (
            nombre,
            telefono,
            licencia_numero,
            tipo_licencia,
            empresa,
            licencia_vencimiento,
            licencia_vigente,
            fecha_manejo_comentado,
            licencia_url,
            licencia_reverso_url,
            activo,
            aprobado_por_admin,
            pin_hash
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            TRUE,
            TRUE,
            $11
          )
          RETURNING
            id_conductores,
            nombre,
            telefono,
            licencia_numero,
            tipo_licencia,
            empresa,
            licencia_vencimiento,
            licencia_vigente,
            fecha_manejo_comentado,
            licencia_url,
            licencia_reverso_url,
            activo,
            aprobado_por_admin,
            (pin_hash IS NOT NULL) AS tiene_pin
        `,
        [
          nombre,
          telefono,
          licenciaNumero,
          tipoLicencia,
          empresa,
          licenciaVencimiento,
          licenciaVigente,
          fechaManejoComentado || null,
          licenciaUrl || null,
          licenciaReversoUrl || null,
          pinHash
        ]
      );

    await client.query("COMMIT");

    return {
      ...result.rows[0],
      pinGenerado: generatedPin
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdminDriverStatus({
  idConductor,
  activo
}) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    if (activo) {
      const error = new Error("Un conductor eliminado no puede reactivarse; crea un registro nuevo.");
      error.code = "DRIVER_DELETED";
      throw error;
    }
    const inProgress = await client.query(`SELECT 1 FROM viajes v INNER JOIN estados_viaje e ON e.id_estado_viaje=v.id_estado_viaje WHERE v.id_conductores=$1 AND e.nombre='EN_CURSO' LIMIT 1`, [idConductor]);
    if (inProgress.rows[0]) {
      const error = new Error("No se puede eliminar un conductor con un viaje en curso.");
      error.code = "TRIP_IN_PROGRESS";
      throw error;
    }
    await client.query(`UPDATE viajes v SET conductor_nombre_historico=COALESCE(v.conductor_nombre_historico,c.nombre) FROM conductores c WHERE v.id_conductores=$1 AND c.id_conductores=$1`, [idConductor]);
    const result = await client.query(`DELETE FROM conductores WHERE id_conductores=$1 RETURNING id_conductores, nombre`, [idConductor]);
    const driver = result.rows[0] ?? null;
    await client.query("COMMIT");
    return driver ? { ...driver, deleted: true } : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function assignVehicleToDriver({ idConductor, idVehiculo }) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    // 1. Desasignar cualquier vehículo previamente asignado a este conductor
    await client.query(
      `UPDATE vehiculos SET id_conductor_asignado = NULL WHERE id_conductor_asignado = $1`,
      [idConductor]
    );

    // 2. Si idVehiculo es un entero válido, asignarlo al conductor
    let assignedVehicle = null;
    if (idVehiculo !== null && idVehiculo !== undefined && idVehiculo !== "" && Number.isInteger(Number(idVehiculo)) && Number(idVehiculo) > 0) {
      const targetVehicleId = Number(idVehiculo);
      // Si el vehículo estaba asignado a otro conductor, lo desasigna primero
      await client.query(
        `UPDATE vehiculos SET id_conductor_asignado = NULL WHERE id_vehiculos = $1`,
        [targetVehicleId]
      );

      const res = await client.query(
        `UPDATE vehiculos 
         SET id_conductor_asignado = $1 
         WHERE id_vehiculos = $2 
         RETURNING id_vehiculos, nombre, numero_economico, placas`,
        [idConductor, targetVehicleId]
      );
      assignedVehicle = res.rows[0] || null;
    }

    await client.query("COMMIT");
    return {
      success: true,
      idConductor,
      vehiculoAsignado: assignedVehicle
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleAdminDriverActive({ idConductor, activo }) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    // Si se intenta desactivar, verificar que no tenga un viaje activo en curso
    if (!activo) {
      const inProgress = await client.query(
        `SELECT 1 
         FROM viajes v 
         INNER JOIN estados_viaje e ON e.id_estado_viaje = v.id_estado_viaje 
         WHERE v.id_conductores = $1 AND e.nombre = 'EN_CURSO' 
         LIMIT 1`,
        [idConductor]
      );
      if (inProgress.rows[0]) {
        const error = new Error("No se puede desactivar un conductor con un viaje actualmente en curso.");
        error.code = "TRIP_IN_PROGRESS";
        throw error;
      }
    }

    const result = await client.query(
      `UPDATE conductores
       SET activo = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_conductores = $2
       RETURNING id_conductores, nombre, activo, aprobado_por_admin, (pin_hash IS NOT NULL) AS tiene_pin`,
      [Boolean(activo), idConductor]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // Sincronizar estado activo en usuarios_telegram asociados a este conductor
    await client.query(
      `UPDATE usuarios_telegram
       SET activo = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_conductores = $2`,
      [Boolean(activo), idConductor]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const HIERARCHY_ROLES = {
  ADMINISTRADOR: [
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
  ],
  GERENTE: [
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE",
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR",
    "OPERADOR",
    "CONSULTA"
  ],
  GERENTE_GENERAL: [
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE",
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR",
    "OPERADOR",
    "CONSULTA"
  ],
  COORDINADOR: [
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR",
    "OPERADOR",
    "CONSULTA"
  ],
  COORDINADOR_AREA: [
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR",
    "OPERADOR",
    "CONSULTA"
  ],
  COORDINADOR_QHSE: [
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR",
    "OPERADOR",
    "CONSULTA"
  ]
};

function mapAdminRoleToTelegramRole(adminRole) {
  const r = String(adminRole || "").toUpperCase();
  if (["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL"].includes(r)) {
    return "ADMINISTRADOR";
  }
  if (["SUPERVISOR", "QHSE", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(r)) {
    return "SUPERVISOR";
  }
  return "CONDUCTOR";
}

export async function getAdminConductorRole({ idConductor }) {
  const conductorResult = await databasePool.query(
    `SELECT
       c.id_conductores,
       c.nombre,
       c.telefono,
       c.empresa,
       c.aprobado_por_admin,
       c.activo,
       (c.pin_hash IS NOT NULL) AS tiene_pin,
       ut.telegram_user_id,
       ut.telegram_username,
       ut.estado_registro
     FROM conductores c
     LEFT JOIN usuarios_telegram ut ON ut.id_conductores = c.id_conductores
     WHERE c.id_conductores = $1
     LIMIT 1`,
    [idConductor]
  );

  const conductor = conductorResult.rows[0];
  if (!conductor) return null;

  const adminUserResult = await databasePool.query(
    `SELECT
       id_usuarios_admin,
       nombre,
       username,
       correo,
       telefono,
       rol,
       activo,
       (pin_hash IS NOT NULL) AS tiene_pin,
       telegram_user_id,
       ultimo_acceso_en
     FROM usuarios_admin
     WHERE id_conductores = $1
     ORDER BY activo DESC, id_usuarios_admin DESC
     LIMIT 1`,
    [idConductor]
  );

  const usuarioAdmin = adminUserResult.rows[0] || null;

  const unlinkedUsersResult = await databasePool.query(
    `SELECT
       id_usuarios_admin,
       nombre,
       username,
       correo,
       rol,
       activo
     FROM usuarios_admin
     WHERE id_conductores IS NULL
     ORDER BY activo DESC, nombre ASC`
  );

  return {
    conductor,
    usuarioAdmin,
    unlinkedUsers: unlinkedUsersResult.rows
  };
}

export async function assignAdminConductorRole({
  idConductor,
  modo = "NUEVO",
  data = {},
  requestingUserRol = "ADMINISTRADOR"
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    // 1. Obtener datos actuales del conductor y su usuario telegram
    const condCheck = await client.query(
      `SELECT c.id_conductores, c.nombre, c.telefono, c.empresa, c.aprobado_por_admin, c.pin_hash,
              ut.telegram_user_id, ut.telegram_username, ut.estado_registro
       FROM conductores c
       LEFT JOIN usuarios_telegram ut ON ut.id_conductores = c.id_conductores
       WHERE c.id_conductores = $1
       FOR UPDATE`,
      [idConductor]
    );

    const conductor = condCheck.rows[0];
    if (!conductor) {
      throw new Error("No se encontró el conductor especificado.");
    }

    // 2. Obtener usuario admin actualmente vinculado (si existe)
    const existingAdminCheck = await client.query(
      `SELECT id_usuarios_admin, username, correo, rol, activo, pin_hash
       FROM usuarios_admin
       WHERE id_conductores = $1
       ORDER BY activo DESC, id_usuarios_admin DESC
       LIMIT 1
       FOR UPDATE`,
      [idConductor]
    );
    const currentAdminUser = existingAdminCheck.rows[0] || null;

    // 3. Validar permisos según jerarquía
    const normalizedCallerRole = String(requestingUserRol || "").toUpperCase();
    const allowedRoles = HIERARCHY_ROLES[normalizedCallerRole] || [];

    if (allowedRoles.length === 0) {
      throw new Error("No tienes permisos para asignar o gestionar roles.");
    }

    if (currentAdminUser && normalizedCallerRole !== "ADMINISTRADOR") {
      if (!allowedRoles.includes(currentAdminUser.rol)) {
        throw new Error(`Tu rol de ${normalizedCallerRole} no tiene permisos para modificar a un usuario con rol ${currentAdminUser.rol}.`);
      }
    }

    let targetRol = data.rol ? String(data.rol).toUpperCase() : (currentAdminUser?.rol || "OPERADOR");

    if (modo !== "REVOCAR") {
      if (!allowedRoles.includes(targetRol)) {
        throw new Error(`Tu rol de ${normalizedCallerRole} no tiene permisos para asignar el rol ${targetRol}.`);
      }
    }

    // 4. Asegurar que el conductor quede APROBADO automáticamente al asignarle un rol
    let generatedPin = null;
    let finalPinHash = conductor.pin_hash;

    if (!conductor.aprobado_por_admin) {
      if (!finalPinHash) {
        generatedPin = String(Math.floor(1000 + Math.random() * 9000));
        finalPinHash = await bcrypt.hash(generatedPin, 10);
      }

      await client.query(
        `UPDATE conductores
         SET aprobado_por_admin = TRUE,
             fecha_aprobacion = CURRENT_TIMESTAMP,
             pin_hash = COALESCE(pin_hash, $1),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_conductores = $2`,
        [finalPinHash, idConductor]
      );

      if (conductor.telegram_user_id) {
        await client.query(
          `UPDATE usuarios_telegram
           SET estado_registro = 'COMPLETO', actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $1`,
          [idConductor]
        );
      }
    }

    let updatedAdmin = null;

    if (modo === "REVOCAR") {
      if (currentAdminUser) {
        await client.query(
          `UPDATE usuarios_admin
           SET id_conductores = NULL,
               actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $1`,
          [idConductor]
        );
      }

      if (conductor.telegram_user_id) {
        await client.query(
          `UPDATE usuarios_telegram
           SET rol = 'CONDUCTOR', actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $1`,
          [idConductor]
        );
      }

      await client.query("COMMIT");
      return {
        conductor: { ...conductor, aprobado_por_admin: true },
        usuarioAdmin: null,
        revoked: true,
        message: "Rol administrativo revocado. El usuario se conserva como conductor."
      };
    }

    if (modo === "VINCULAR") {
      const idUsuariosAdmin = Number(data.idUsuariosAdmin);
      if (!Number.isInteger(idUsuariosAdmin) || idUsuariosAdmin <= 0) {
        throw new Error("El usuario administrativo a vincular no es válido.");
      }

      const targetCheck = await client.query(
        `SELECT id_usuarios_admin, nombre, username, correo, rol, id_conductores, pin_hash
         FROM usuarios_admin WHERE id_usuarios_admin = $1 FOR UPDATE`,
        [idUsuariosAdmin]
      );

      const targetAdmin = targetCheck.rows[0];
      if (!targetAdmin) {
        throw new Error("El usuario administrativo seleccionado no existe.");
      }

      if (targetAdmin.id_conductores && targetAdmin.id_conductores !== idConductor) {
        throw new Error("El usuario administrativo ya se encuentra vinculado a otro conductor.");
      }

      const newRoleToApply = data.rol ? targetRol : targetAdmin.rol;
      if (!allowedRoles.includes(newRoleToApply)) {
        throw new Error(`No tienes permisos para vincular con rol ${newRoleToApply}.`);
      }

      // Sincronizar PIN si conductor ya lo tiene y admin no
      const adminPinHash = targetAdmin.pin_hash || finalPinHash || null;

      const vincularResult = await client.query(
        `UPDATE usuarios_admin
         SET id_conductores = $1,
             rol = $2,
             pin_hash = COALESCE(pin_hash, $3),
             telegram_user_id = COALESCE(telegram_user_id, $4),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_usuarios_admin = $5
         RETURNING id_usuarios_admin, nombre, username, correo, telefono, rol, activo, (pin_hash IS NOT NULL) AS tiene_pin`,
        [idConductor, newRoleToApply, adminPinHash, conductor.telegram_user_id || null, idUsuariosAdmin]
      );
      updatedAdmin = vincularResult.rows[0];

      // Sincronizar PIN de vuelta a conductor si el admin tenía PIN y el conductor no
      if (targetAdmin.pin_hash && !conductor.pin_hash) {
        await client.query(
          `UPDATE conductores SET pin_hash = $1 WHERE id_conductores = $2`,
          [targetAdmin.pin_hash, idConductor]
        );
      }

      // Sincronizar rol en usuarios_telegram
      if (conductor.telegram_user_id) {
        const tgRol = mapAdminRoleToTelegramRole(newRoleToApply);
        await client.query(
          `UPDATE usuarios_telegram
           SET rol = $1, estado_registro = 'COMPLETO', actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $2`,
          [tgRol, idConductor]
        );
      }
    } else if (modo === "ACTUALIZAR" && currentAdminUser) {
      const username = String(data.username || currentAdminUser.username || "").trim().toLowerCase();
      const correo = data.correo ? String(data.correo).trim().toLowerCase() : currentAdminUser.correo;
      const activo = data.activo !== undefined ? Boolean(data.activo) : currentAdminUser.activo;

      if (username.length < 3) {
        throw new Error("El nombre de usuario debe tener al menos 3 caracteres.");
      }

      // Validar que username no esté en uso por otro
      const dupCheck = await client.query(
        `SELECT id_usuarios_admin FROM usuarios_admin WHERE LOWER(username) = LOWER($1) AND id_usuarios_admin != $2 LIMIT 1`,
        [username, currentAdminUser.id_usuarios_admin]
      );
      if (dupCheck.rows[0]) {
        throw new Error("El nombre de usuario ya está en uso por otra cuenta.");
      }

      let passwordClause = "";
      const updateParams = [targetRol, username, correo || null, activo, conductor.telegram_user_id || null, currentAdminUser.id_usuarios_admin];

      if (data.password && String(data.password).trim().length >= 8) {
        const hash = await bcrypt.hash(String(data.password).trim(), 10);
        updateParams.splice(4, 0, hash);
        passwordClause = ", password_hash = $5";
      }

      const updateQuery = `
        UPDATE usuarios_admin
        SET rol = $1,
            username = $2,
            correo = $3,
            activo = $4
            ${passwordClause},
            telegram_user_id = COALESCE(telegram_user_id, $${updateParams.length - 1}),
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id_usuarios_admin = $${updateParams.length}
        RETURNING id_usuarios_admin, nombre, username, correo, telefono, rol, activo, (pin_hash IS NOT NULL) AS tiene_pin
      `;

      const updRes = await client.query(updateQuery, updateParams);
      updatedAdmin = updRes.rows[0];

      if (conductor.telegram_user_id) {
        const tgRol = mapAdminRoleToTelegramRole(targetRol);
        await client.query(
          `UPDATE usuarios_telegram
           SET rol = $1, estado_registro = 'COMPLETO', actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $2`,
          [tgRol, idConductor]
        );
      }
    } else {
      // modo === "NUEVO"
      const rawUsername = data.username || conductor.nombre.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").slice(0, 30);
      const username = String(rawUsername).trim().toLowerCase();
      const correo = data.correo ? String(data.correo).trim().toLowerCase() : null;
      const activo = data.activo !== false;

      if (username.length < 3) {
        throw new Error("El nombre de usuario debe tener al menos 3 caracteres.");
      }

      // Validar si username ya existe
      const dupCheck = await client.query(
        `SELECT id_usuarios_admin FROM usuarios_admin WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [username]
      );
      if (dupCheck.rows[0]) {
        throw new Error(`El nombre de usuario "${username}" ya está registrado. Por favor ingresa uno diferente.`);
      }

      if (correo) {
        const dupEmail = await client.query(
          `SELECT id_usuarios_admin FROM usuarios_admin WHERE LOWER(correo) = LOWER($1) LIMIT 1`,
          [correo]
        );
        if (dupEmail.rows[0]) {
          throw new Error(`El correo corporativo "${correo}" ya está registrado en otra cuenta.`);
        }
      }

      let passwordPlain = data.password ? String(data.password).trim() : null;
      if (!passwordPlain || passwordPlain.length < 8) {
        passwordPlain = Math.random().toString(36).slice(-10) + "Aa1!";
      }
      const passwordHash = await bcrypt.hash(passwordPlain, 10);

      const insertResult = await client.query(
        `INSERT INTO usuarios_admin (
           nombre, username, correo, password_hash, rol, activo, id_conductores, pin_hash, telefono, telegram_user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id_usuarios_admin, nombre, username, correo, telefono, rol, activo, (pin_hash IS NOT NULL) AS tiene_pin`,
        [
          conductor.nombre,
          username,
          correo || null,
          passwordHash,
          targetRol,
          activo,
          idConductor,
          finalPinHash || null,
          conductor.telefono || null,
          conductor.telegram_user_id || null
        ]
      );
      updatedAdmin = insertResult.rows[0];

      if (conductor.telegram_user_id) {
        const tgRol = mapAdminRoleToTelegramRole(targetRol);
        await client.query(
          `UPDATE usuarios_telegram
           SET rol = $1, estado_registro = 'COMPLETO', actualizado_en = CURRENT_TIMESTAMP
           WHERE id_conductores = $2`,
          [tgRol, idConductor]
        );
      }
    }

    await client.query("COMMIT");

    return {
      conductor: { ...conductor, aprobado_por_admin: true, pinGenerado: generatedPin },
      usuarioAdmin: updatedAdmin,
      message: `Rol ${targetRol} asignado exitosamente a ${conductor.nombre}.`
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


