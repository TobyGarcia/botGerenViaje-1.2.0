import {
  databasePool
} from "../database/pool.js";

function buildVehicleName(
  marca,
  modelo
) {
  return `${marca} ${modelo}`
    .replace(/\s+/g, " ")
    .trim();
}

export async function listAdminVehicles({
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
        v.nombre ILIKE $${values.length}
        OR v.numero_economico ILIKE $${values.length}
        OR v.placas ILIKE $${values.length}
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
      `v.activo = $${values.length}`
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
          v.id_vehiculos,
          v.nombre,
          v.numero_economico,
          v.placas,
          v.activo
        FROM vehiculos v
        ${whereClause}
        ORDER BY
          v.activo DESC,
          v.nombre ASC
      `,
      values
    );

  return result.rows;
}

export async function createAdminVehicle({
  marca,
  modelo,
  numeroEconomico,
  placas
}) {
  const nombre =
    buildVehicleName(
      marca,
      modelo
    );

  const client =
    await databasePool.connect();

  try {
    await client.query("BEGIN");

    const duplicateResult =
      await client.query(
        `
          SELECT
            id_vehiculos,
            numero_economico,
            placas
          FROM vehiculos
          WHERE
            LOWER(numero_economico) =
              LOWER($1)
            OR LOWER(placas) =
              LOWER($2)
          LIMIT 1
        `,
        [
          numeroEconomico,
          placas
        ]
      );

    const duplicate =
      duplicateResult.rows[0];

    if (duplicate) {
      const error =
        new Error(
          "Ya existe un vehículo con ese número económico o placas."
        );

      error.code =
        "VEHICLE_DUPLICATE";

      throw error;
    }

    const result =
      await client.query(
        `
          INSERT INTO vehiculos (
            nombre,
            numero_economico,
            placas,
            activo
          )
          VALUES (
            $1,
            $2,
            $3,
            TRUE
          )
          RETURNING
            id_vehiculos,
            nombre,
            numero_economico,
            placas,
            activo
        `,
        [
          nombre,
          numeroEconomico,
          placas
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

export async function updateAdminVehicleStatus({
  idVehiculo,
  activo
}) {
  const result =
    await databasePool.query(
      `
        UPDATE vehiculos
        SET
          activo = $1
        WHERE id_vehiculos = $2
        RETURNING
          id_vehiculos,
          nombre,
          numero_economico,
          placas,
          activo
      `,
      [
        activo,
        idVehiculo
      ]
    );

  return result.rows[0] ?? null;
}