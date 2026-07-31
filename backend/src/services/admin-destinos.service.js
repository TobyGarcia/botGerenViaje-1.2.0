import {
  databasePool
} from "../database/pool.js";

export async function listAdminDestinations({
  search = "",
  status = "TODOS"
} = {}) {
  const normalizedSearch = String(search).trim();
  const normalizedStatus = String(status).toUpperCase();
  const values = [];
  const conditions = [];

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    conditions.push(`
      (
        l.nombre ILIKE $${values.length}
        OR COALESCE(l.direccion, '') ILIKE $${values.length}
      )
    `);
  }

  if (
    normalizedStatus === "ACTIVOS" ||
    normalizedStatus === "INACTIVOS"
  ) {
    values.push(normalizedStatus === "ACTIVOS");
    conditions.push(`l.activo = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await databasePool.query(
    `
      SELECT
        l.id_lugares,
        l.nombre,
        l.direccion,
        l.activo
      FROM lugares l
      ${whereClause}
      ORDER BY l.activo DESC, l.nombre ASC
    `,
    values
  );

  return result.rows;
}

export async function createAdminDestination({
  nombre,
  direccion
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT id_lugares, nombre, activo
        FROM lugares
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
        LIMIT 1
      `,
      [nombre]
    );

    const existingDestination = existingResult.rows[0];

    if (existingDestination) {
      const error = new Error(
        existingDestination.activo
          ? "Ya existe un destino con ese nombre."
          : "Ese destino ya existe, pero está inactivo. Puedes reactivarlo."
      );

      error.code = existingDestination.activo
        ? "DESTINATION_EXISTS"
        : "DESTINATION_INACTIVE";
      error.destination = existingDestination;
      throw error;
    }

    const result = await client.query(
      `
        INSERT INTO lugares (nombre, direccion, activo)
        VALUES ($1, $2, TRUE)
        RETURNING id_lugares, nombre, direccion, activo
      `,
      [nombre, direccion]
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

export async function updateAdminDestination({
  idDestino,
  nombre,
  direccion
}) {
  const existingResult = await databasePool.query(
    `
      SELECT id_lugares
      FROM lugares
      WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
        AND id_lugares <> $2
      LIMIT 1
    `,
    [nombre, idDestino]
  );

  if (existingResult.rows[0]) {
    const error = new Error(
      "Ya existe un destino con ese nombre."
    );
    error.code = "DESTINATION_EXISTS";
    throw error;
  }

  const result = await databasePool.query(
    `
      UPDATE lugares
      SET nombre = $1, direccion = $2
      WHERE id_lugares = $3
      RETURNING id_lugares, nombre, direccion, activo
    `,
    [nombre, direccion, idDestino]
  );

  return result.rows[0] ?? null;
}

export async function updateAdminDestinationStatus({
  idDestino,
  activo
}) {
  const result = await databasePool.query(
    `
      UPDATE lugares
      SET activo = $1
      WHERE id_lugares = $2
      RETURNING id_lugares, nombre, direccion, activo
    `,
    [activo, idDestino]
  );

  return result.rows[0] ?? null;
}
