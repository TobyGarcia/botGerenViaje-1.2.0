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
          c.telefono,
          c.licencia_numero,
          c.tipo_licencia,
          c.licencia_vencimiento,
          c.licencia_vigente,
          c.activo,

          ut.telegram_user_id,
          ut.telegram_username,
          ut.estado_registro

        FROM conductores c

        LEFT JOIN usuarios_telegram ut
          ON ut.id_conductores =
             c.id_conductores

        ${whereClause}

        ORDER BY
          c.activo DESC,
          c.nombre ASC
      `,
      values
    );

  return result.rows;
}

export async function createAdminDriver({
  nombre,
  telefono,
  licenciaNumero,
  tipoLicencia,
  licenciaVencimiento
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

    const result =
      await client.query(
        `
          INSERT INTO conductores (
            nombre,
            telefono,
            licencia_numero,
            tipo_licencia,
            licencia_vencimiento,
            licencia_vigente,
            activo
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            TRUE
          )
          RETURNING
            id_conductores,
            nombre,
            telefono,
            licencia_numero,
            tipo_licencia,
            licencia_vencimiento,
            licencia_vigente,
            activo
        `,
        [
          nombre,
          telefono,
          licenciaNumero,
          tipoLicencia,
          licenciaVencimiento,
          licenciaVigente
        ]
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
