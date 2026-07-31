import {
  databasePool
} from "../database/pool.js";
import { registerMileageReading } from "./kilometraje.service.js";

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
          v.activo,
          COALESCE(ultima_lectura.kilometraje, v.kilometraje_actual) AS kilometraje_actual,
          ultima_lectura.fecha_lectura AS fecha_ultima_lectura
        FROM vehiculos v
        LEFT JOIN LATERAL (
          SELECT kilometraje, fecha_lectura
          FROM historial_kilometraje_vehiculos
          WHERE id_vehiculos = v.id_vehiculos
          ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC
          LIMIT 1
        ) ultima_lectura ON TRUE
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

export async function getAdminVehicleMileageHistory({
  idVehiculo,
  dateFrom = "",
  dateTo = "",
  type = "TODOS"
}) {
  const conditions = ["h.id_vehiculos = $1"];
  const values = [idVehiculo];
  const normalizedType = String(type).trim().toUpperCase();

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`h.fecha_lectura >= $${values.length}::date`);
  }
  if (dateTo) {
    values.push(dateTo);
    conditions.push(`h.fecha_lectura < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (normalizedType && normalizedType !== "TODOS") {
    values.push(normalizedType);
    conditions.push(`h.tipo_registro = $${values.length}`);
  }

  const vehicleResult = await databasePool.query(
    `SELECT id_vehiculos, nombre, numero_economico, placas
       FROM vehiculos WHERE id_vehiculos = $1 LIMIT 1`,
    [idVehiculo]
  );
  if (!vehicleResult.rows[0]) return null;

  const result = await databasePool.query(
    `SELECT h.*, v.folio, ua.nombre AS usuario_admin,
       h.kilometraje - LAG(h.kilometraje) OVER (
         ORDER BY h.fecha_lectura ASC, h.id_historial_kilometraje ASC
       ) AS diferencia_anterior
     FROM historial_kilometraje_vehiculos h
     LEFT JOIN viajes v ON v.id_viajes = h.id_viajes
     LEFT JOIN usuarios_admin ua ON ua.id_usuarios_admin = h.id_usuarios_admin
     WHERE ${conditions.join(" AND ")}
     ORDER BY h.fecha_lectura DESC, h.id_historial_kilometraje DESC`,
    values
  );

  return { vehiculo: vehicleResult.rows[0], historial: result.rows };
}

export async function getAdminVehicleMileageSummary(idVehiculo) {
  const result = await databasePool.query(
    `SELECT
       v.id_vehiculos,
       COALESCE(ultima.kilometraje, v.kilometraje_actual) AS kilometraje_actual,
       primera.kilometraje AS primera_lectura,
       primera.fecha_lectura AS fecha_primera_lectura,
       ultima.fecha_lectura AS fecha_ultima_lectura,
       COALESCE(viajes.total_viajes, 0)::INTEGER AS total_viajes,
       COALESCE(viajes.kilometros_recorridos, 0)::INTEGER AS kilometros_recorridos
     FROM vehiculos v
     LEFT JOIN LATERAL (
       SELECT kilometraje, fecha_lectura FROM historial_kilometraje_vehiculos
       WHERE id_vehiculos = v.id_vehiculos
       ORDER BY fecha_lectura ASC, id_historial_kilometraje ASC LIMIT 1
     ) primera ON TRUE
     LEFT JOIN LATERAL (
       SELECT kilometraje, fecha_lectura FROM historial_kilometraje_vehiculos
       WHERE id_vehiculos = v.id_vehiculos
       ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC LIMIT 1
     ) ultima ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS total_viajes, COALESCE(SUM(kilometros_recorridos), 0) AS kilometros_recorridos
       FROM viajes WHERE id_vehiculos = v.id_vehiculos AND kilometros_recorridos IS NOT NULL
     ) viajes ON TRUE
     WHERE v.id_vehiculos = $1
     LIMIT 1`,
    [idVehiculo]
  );
  return result.rows[0] ?? null;
}

export async function createAdminVehicleMileageReading({
  idVehiculo, kilometraje, observaciones, idUsuarioAdmin, correctionOf = null
}) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const vehicle = await client.query(
      "SELECT id_vehiculos FROM vehiculos WHERE id_vehiculos = $1 FOR UPDATE",
      [idVehiculo]
    );
    if (!vehicle.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    if (correctionOf) {
      const original = await client.query(
        `SELECT id_historial_kilometraje FROM historial_kilometraje_vehiculos
         WHERE id_historial_kilometraje = $1 AND id_vehiculos = $2 LIMIT 1`,
        [correctionOf, idVehiculo]
      );
      if (!original.rows[0]) {
        const error = new Error("El registro a corregir no corresponde a la unidad.");
        error.code = "MILEAGE_RECORD_NOT_FOUND";
        throw error;
      }
    }

    const reading = await registerMileageReading({
      client, idVehiculo, kilometraje,
      tipoRegistro: correctionOf ? "CORRECCION" : "AJUSTE_MANUAL",
      origen: "PANEL_ADMIN", observaciones, idUsuarioAdmin,
      idRegistroCorregido: correctionOf, allowLower: Boolean(correctionOf)
    });
    await client.query("COMMIT");
    return reading;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
