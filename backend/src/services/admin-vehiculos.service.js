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
        OR v.marca ILIKE $${values.length}
        OR v.modelo ILIKE $${values.length}
        OR v.numero_economico ILIKE $${values.length}
        OR v.placas ILIKE $${values.length}
        OR v.numero_serie ILIKE $${values.length}
        OR v.color ILIKE $${values.length}
        OR COALESCE(c_asig.nombre, s_asig.nombre, v.personal_asignado_nombre) ILIKE $${values.length}
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
          v.marca,
          v.modelo,
          v.numero_economico,
          v.placas,
          v.tipo_vehiculo,
          v.tipo_propiedad,
          v.color,
          v.id_conductor_asignado,
          v.id_supervisor_asignado,
          v.personal_asignado_nombre,
          COALESCE(c_asig.nombre, s_asig.nombre, v.personal_asignado_nombre) AS personal_asignado,
          c_asig.nombre AS conductor_asignado_nombre,
          s_asig.nombre AS supervisor_asignado_nombre,
          v.en_mantenimiento,
          v.activo,
          COALESCE(ultima_lectura.kilometraje, v.kilometraje_actual) AS kilometraje_actual,
          ultima_lectura.fecha_lectura AS fecha_ultima_lectura,
          viaje_en_curso.folio AS folio_viaje_en_curso,
          CASE
            WHEN NOT v.activo THEN 'INACTIVO'
            WHEN v.en_mantenimiento THEN 'MANTENIMIENTO'
            WHEN viaje_en_curso.id_viajes IS NOT NULL THEN 'EN_VIAJE'
            ELSE 'DISPONIBLE'
          END AS disponibilidad
        FROM vehiculos v
        LEFT JOIN conductores c_asig ON c_asig.id_conductores = v.id_conductor_asignado
        LEFT JOIN usuarios_admin s_asig ON s_asig.id_usuarios_admin = v.id_supervisor_asignado
        LEFT JOIN LATERAL (
          SELECT kilometraje, fecha_lectura
          FROM historial_kilometraje_vehiculos
          WHERE id_vehiculos = v.id_vehiculos
          ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC
          LIMIT 1
        ) ultima_lectura ON TRUE
        LEFT JOIN LATERAL (
          SELECT viaje.id_viajes, viaje.folio
          FROM viajes viaje
          INNER JOIN estados_viaje estado
            ON estado.id_estado_viaje = viaje.id_estado_viaje
          WHERE viaje.id_vehiculos = v.id_vehiculos
            AND estado.nombre = 'EN_CURSO'
          ORDER BY viaje.id_viajes DESC
          LIMIT 1
        ) viaje_en_curso ON TRUE
        ${whereClause}
        ORDER BY
          v.activo DESC,
          v.marca ASC,
          v.modelo ASC,
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
  placas,
  numeroPoliza,
  seguroVencimiento,
  numeroSerie,
  tipoVehiculo,
  tipoPropiedad,
  color = null,
  idConductorAsignado = null,
  idSupervisorAsignado = null,
  personalAsignadoNombre = null
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
            placas,
            numero_serie
          FROM vehiculos
          WHERE
            LOWER(numero_economico) =
              LOWER($1)
            OR LOWER(placas) =
              LOWER($2)
            OR LOWER(numero_serie) = LOWER($3)
          LIMIT 1
        `,
        [
          numeroEconomico,
          placas,
          numeroSerie
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
            marca,
            modelo,
            numero_economico,
            placas,
            numero_poliza,
            seguro_vencimiento,
            numero_serie,
            tipo_vehiculo,
            tipo_propiedad,
            color,
            id_conductor_asignado,
            id_supervisor_asignado,
            personal_asignado_nombre,
            activo
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
            $11,
            $12,
            $13,
            $14,
            TRUE
          )
          RETURNING
            id_vehiculos,
            nombre,
            marca,
            modelo,
            numero_economico,
            placas,
            numero_poliza,
            seguro_vencimiento,
            numero_serie,
            tipo_vehiculo,
            tipo_propiedad,
            color,
            id_conductor_asignado,
            id_supervisor_asignado,
            personal_asignado_nombre,
            activo
        `,
        [
          nombre,
          marca,
          modelo,
          numeroEconomico,
          placas,
          numeroPoliza,
          seguroVencimiento,
          numeroSerie,
          tipoVehiculo,
          tipoPropiedad,
          color || null,
          idConductorAsignado || null,
          idSupervisorAsignado || null,
          personalAsignadoNombre || null
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

export async function getAdminVehicleDetail(idVehiculo) {
  const result = await databasePool.query(
    `
      SELECT
        v.id_vehiculos, v.nombre, v.marca, v.modelo, v.numero_economico,
        v.placas, v.numero_poliza, v.seguro_vencimiento, v.numero_serie,
        v.tipo_vehiculo, v.tipo_propiedad, v.color,
        v.id_conductor_asignado, v.id_supervisor_asignado, v.personal_asignado_nombre,
        COALESCE(c_asig.nombre, s_asig.nombre, v.personal_asignado_nombre) AS personal_asignado,
        c_asig.nombre AS conductor_asignado_nombre,
        s_asig.nombre AS supervisor_asignado_nombre,
        v.en_mantenimiento, v.activo,
        COALESCE(ultima_lectura.kilometraje, v.kilometraje_actual) AS kilometraje_actual,
        ultima_lectura.fecha_lectura AS fecha_ultima_lectura,
        viaje_en_curso.id_viajes AS id_viaje_en_curso,
        viaje_en_curso.folio AS folio_viaje_en_curso,
        viaje_en_curso.conductor AS conductor_viaje_en_curso,
        CASE
          WHEN NOT v.activo THEN 'INACTIVO'
          WHEN v.en_mantenimiento THEN 'MANTENIMIENTO'
          WHEN viaje_en_curso.id_viajes IS NOT NULL THEN 'EN_VIAJE'
          ELSE 'DISPONIBLE'
        END AS disponibilidad
      FROM vehiculos v
      LEFT JOIN conductores c_asig ON c_asig.id_conductores = v.id_conductor_asignado
      LEFT JOIN usuarios_admin s_asig ON s_asig.id_usuarios_admin = v.id_supervisor_asignado
      LEFT JOIN LATERAL (
        SELECT kilometraje, fecha_lectura
        FROM historial_kilometraje_vehiculos
        WHERE id_vehiculos = v.id_vehiculos
        ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC
        LIMIT 1
      ) ultima_lectura ON TRUE
      LEFT JOIN LATERAL (
        SELECT viaje.id_viajes, viaje.folio, conductor.nombre AS conductor
        FROM viajes viaje
        INNER JOIN estados_viaje estado ON estado.id_estado_viaje = viaje.id_estado_viaje
        INNER JOIN conductores conductor ON conductor.id_conductores = viaje.id_conductores
        WHERE viaje.id_vehiculos = v.id_vehiculos AND estado.nombre = 'EN_CURSO'
        ORDER BY viaje.id_viajes DESC
        LIMIT 1
      ) viaje_en_curso ON TRUE
      WHERE v.id_vehiculos = $1
      LIMIT 1
    `,
    [idVehiculo]
  );

  return result.rows[0] ?? null;
}

export async function updateAdminVehicle({
  idVehiculo, marca, modelo, numeroEconomico, placas, numeroPoliza,
  seguroVencimiento, numeroSerie, tipoVehiculo, tipoPropiedad,
  color = null, idConductorAsignado = null, idSupervisorAsignado = null, personalAsignadoNombre = null
}) {
  const nombre = buildVehicleName(marca, modelo);
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    if (idConductorAsignado && Number.isInteger(Number(idConductorAsignado))) {
      const condId = Number(idConductorAsignado);
      await client.query(
        `UPDATE vehiculos SET id_conductor_asignado = NULL WHERE id_conductor_asignado = $1 AND id_vehiculos <> $2`,
        [condId, idVehiculo]
      );
    }

    const result = await client.query(
      `
        UPDATE vehiculos
        SET nombre = $1, marca = $2, modelo = $3, numero_economico = $4,
            placas = $5, numero_poliza = $6, seguro_vencimiento = $7,
            numero_serie = $8, tipo_vehiculo = $9, tipo_propiedad = $10,
            color = $11, id_conductor_asignado = $12, id_supervisor_asignado = $13,
            personal_asignado_nombre = $14,
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id_vehiculos = $15
          AND NOT EXISTS (
            SELECT 1 FROM vehiculos duplicado
            WHERE duplicado.id_vehiculos <> $15
              AND (LOWER(duplicado.numero_economico) = LOWER($4)
                OR LOWER(duplicado.placas) = LOWER($5)
                OR LOWER(duplicado.numero_serie) = LOWER($8))
          )
        RETURNING id_vehiculos, nombre, marca, modelo, numero_economico, placas,
          numero_poliza, seguro_vencimiento, numero_serie, tipo_vehiculo, tipo_propiedad,
          color, id_conductor_asignado, id_supervisor_asignado, personal_asignado_nombre
      `,
      [
        nombre, marca, modelo, numeroEconomico, placas, numeroPoliza, seguroVencimiento,
        numeroSerie, tipoVehiculo, tipoPropiedad, color || null,
        idConductorAsignado || null, idSupervisorAsignado || null,
        personalAsignadoNombre || null, idVehiculo
      ]
    );

    await client.query("COMMIT");
    return result.rows[0] ?? null;
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
  if (activo) {
    const error = new Error("Una unidad eliminada no puede reactivarse; registra una nueva.");
    error.code = "VEHICLE_DELETED";
    throw error;
  }
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const inProgress = await client.query(`SELECT 1 FROM viajes v INNER JOIN estados_viaje e ON e.id_estado_viaje=v.id_estado_viaje WHERE v.id_vehiculos=$1 AND e.nombre='EN_CURSO' LIMIT 1`, [idVehiculo]);
    if (inProgress.rows[0]) { const error = new Error("No se puede eliminar una unidad con un viaje en curso."); error.code="TRIP_IN_PROGRESS"; throw error; }
    await client.query(`UPDATE viajes v SET vehiculo_nombre_historico=COALESCE(v.vehiculo_nombre_historico,vh.nombre), vehiculo_numero_economico_historico=COALESCE(v.vehiculo_numero_economico_historico,vh.numero_economico), vehiculo_placas_historico=COALESCE(v.vehiculo_placas_historico,vh.placas) FROM vehiculos vh WHERE v.id_vehiculos=$1 AND vh.id_vehiculos=$1`, [idVehiculo]);
    const result = await client.query(`DELETE FROM vehiculos WHERE id_vehiculos=$1 RETURNING id_vehiculos, nombre`, [idVehiculo]);
    await client.query("COMMIT");
    return result.rows[0] ? { ...result.rows[0], deleted: true } : null;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function updateAdminVehicleMaintenance({ idVehiculo, enMantenimiento }) {
  const result = await databasePool.query(
    `
      UPDATE vehiculos
      SET en_mantenimiento = $1, actualizado_en = CURRENT_TIMESTAMP
      WHERE id_vehiculos = $2
        AND NOT EXISTS (
          SELECT 1
          FROM viajes viaje
          INNER JOIN estados_viaje estado ON estado.id_estado_viaje = viaje.id_estado_viaje
          WHERE viaje.id_vehiculos = vehiculos.id_vehiculos
            AND estado.nombre = 'EN_CURSO'
        )
      RETURNING id_vehiculos, en_mantenimiento, activo
    `,
    [enMantenimiento, idVehiculo]
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
