import {
  databasePool
} from "../database/pool.js";
import { importDestinationsFromRows } from "../scripts/import-destinos-csv.js";

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
        l.latitud,
        l.longitud,
        l.activo,
        l.creado_en
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
  direccion,
  latitud = null,
  longitud = null
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
        INSERT INTO lugares (nombre, direccion, latitud, longitud, activo)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING id_lugares, nombre, direccion, latitud, longitud, activo, creado_en
      `,
      [nombre, direccion, latitud, longitud]
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
  direccion,
  latitud = null,
  longitud = null
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
      SET nombre = $1,
          direccion = $2,
          latitud = $3,
          longitud = $4,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id_lugares = $5
      RETURNING id_lugares, nombre, direccion, latitud, longitud, activo, actualizado_en
    `,
    [nombre, direccion, latitud, longitud, idDestino]
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
      SET activo = $1,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id_lugares = $2
      RETURNING id_lugares, nombre, direccion, latitud, longitud, activo
    `,
    [activo, idDestino]
  );

  return result.rows[0] ?? null;
}

export async function deleteAdminDestination(idDestino) {
  const usageCheck = await databasePool.query(
    `
      SELECT
        (SELECT COUNT(*) FROM viajes WHERE id_origen = $1 OR id_destino = $1) AS viajes_count,
        (SELECT COUNT(*) FROM gerenciamiento_viajes WHERE id_origen = $1 OR id_destino = $1) AS gerenciamiento_count
    `,
    [idDestino]
  );

  const viajesCount = Number(usageCheck.rows[0]?.viajes_count || 0);
  const gerenciamientoCount = Number(usageCheck.rows[0]?.gerenciamiento_count || 0);
  const totalUsos = viajesCount + gerenciamientoCount;

  if (totalUsos > 0) {
    const error = new Error(
      `No se puede eliminar este destino porque está asociado a ${totalUsos} viaje(s) en el historial. Puedes darlo de baja para que no aparezca en nuevos viajes.`
    );
    error.code = "DESTINATION_HAS_TRIPS";
    throw error;
  }

  const result = await databasePool.query(
    `
      DELETE FROM lugares
      WHERE id_lugares = $1
      RETURNING id_lugares, nombre
    `,
    [idDestino]
  );

  return result.rows[0] ?? null;
}

export async function importAdminDestinations(destinations) {
  return await importDestinationsFromRows(destinations);
}

