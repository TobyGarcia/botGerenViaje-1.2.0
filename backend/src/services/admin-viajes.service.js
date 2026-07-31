import {
  databasePool
} from "../database/pool.js";

export async function getAdminDashboardSummary() {
  const [summaryResult, activityResult] = await Promise.all([
    databasePool.query(
      `
        SELECT
          (SELECT COUNT(*)::INTEGER FROM conductores) AS conductores_total,
          (SELECT COUNT(*)::INTEGER FROM conductores WHERE activo = TRUE) AS conductores_activos,
          (SELECT COUNT(*)::INTEGER FROM vehiculos) AS unidades_total,
          (SELECT COUNT(*)::INTEGER FROM vehiculos WHERE activo = TRUE) AS unidades_activas,
          (SELECT COUNT(*)::INTEGER FROM viajes) AS viajes_total,
          (SELECT COUNT(*)::INTEGER FROM viajes v
            INNER JOIN estados_viaje ev ON ev.id_estado_viaje = v.id_estado_viaje
            WHERE ev.nombre = 'EN_CURSO') AS viajes_en_curso
      `
    ),
    databasePool.query(
      `
        SELECT
          serie.fecha::date AS fecha,
          COUNT(v.id_viajes)::INTEGER AS total
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS serie(fecha)
        LEFT JOIN viajes v
          ON v.fecha = serie.fecha::date
        GROUP BY serie.fecha
        ORDER BY serie.fecha
      `
    )
  ]);

  return {
    ...summaryResult.rows[0],
    actividad: activityResult.rows
  };
}

export async function listAdminTrips({
  search = "",
  status = "TODOS",
  dateFrom = "",
  dateTo = ""
} = {}) {
  const normalizedSearch =
    String(search).trim();

  const normalizedStatus =
    String(status).trim().toUpperCase();

  const values = [];
  const conditions = [];

  if (normalizedSearch) {
    values.push(
      `%${normalizedSearch}%`
    );

    const parameter =
      `$${values.length}`;

    conditions.push(`
      (
        v.folio ILIKE ${parameter}
        OR c.nombre ILIKE ${parameter}
        OR vh.nombre ILIKE ${parameter}
        OR vh.numero_economico ILIKE ${parameter}
        OR vh.placas ILIKE ${parameter}
        OR origen.nombre ILIKE ${parameter}
        OR destino.nombre ILIKE ${parameter}
        OR COALESCE(v.motivo, '') ILIKE ${parameter}
      )
    `);
  }

  if (
    normalizedStatus &&
    normalizedStatus !== "TODOS"
  ) {
    values.push(
      normalizedStatus
    );

    conditions.push(
      `UPPER(ev.nombre) = $${values.length}`
    );
  }

  if (dateFrom) {
    values.push(dateFrom);

    conditions.push(
      `v.fecha >= $${values.length}::date`
    );
  }

  if (dateTo) {
    values.push(dateTo);

    conditions.push(
      `v.fecha <= $${values.length}::date`
    );
  }

  const whereClause =
    conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result =
    await databasePool.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          v.acompanantes,
          v.licencia_vigente,
          v.kilometraje_inicial,
          v.kilometraje_final,
          v.kilometros_recorridos,
          v.motivo,
          v.fecha,
          v.hora_salida,
          v.hora_llegada,
          v.creado_en,
          v.actualizado_en,

          c.id_conductores,
          c.nombre AS conductor,

          vh.id_vehiculos,
          vh.nombre AS vehiculo,
          vh.numero_economico,
          vh.placas,

          origen.id_lugares AS id_origen,
          origen.nombre AS origen,
          origen.direccion AS origen_direccion,

          destino.id_lugares AS id_destino,
          destino.nombre AS destino,
          destino.direccion AS destino_direccion,

          ev.id_estado_viaje,
          ev.nombre AS estado,

          COUNT(
            uv.id_ubicaciones_viaje
          )::INTEGER AS total_ubicaciones

        FROM viajes v

        INNER JOIN conductores c
          ON c.id_conductores =
             v.id_conductores

        INNER JOIN vehiculos vh
          ON vh.id_vehiculos =
             v.id_vehiculos

        INNER JOIN lugares origen
          ON origen.id_lugares =
             v.id_origen

        INNER JOIN lugares destino
          ON destino.id_lugares =
             v.id_destino

        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje =
             v.id_estado_viaje

        LEFT JOIN ubicaciones_viaje uv
          ON uv.id_viajes =
             v.id_viajes

        ${whereClause}

        GROUP BY
          v.id_viajes,
          c.id_conductores,
          c.nombre,
          vh.id_vehiculos,
          vh.nombre,
          vh.numero_economico,
          vh.placas,
          origen.id_lugares,
          origen.nombre,
          origen.direccion,
          destino.id_lugares,
          destino.nombre,
          destino.direccion,
          ev.id_estado_viaje,
          ev.nombre

        ORDER BY
          v.fecha DESC,
          v.creado_en DESC,
          v.id_viajes DESC
      `,
      values
    );

  return result.rows;
}

export async function getAdminTripById(
  idViaje
) {
  const tripResult =
    await databasePool.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          v.acompanantes,
          v.licencia_vigente,
          v.kilometraje_inicial,
          v.kilometraje_final,
          v.kilometros_recorridos,
          v.motivo,
          v.fecha,
          v.hora_salida,
          v.hora_llegada,
          v.creado_en,
          v.actualizado_en,

          c.id_conductores,
          c.nombre AS conductor,

          vh.id_vehiculos,
          vh.nombre AS vehiculo,
          vh.numero_economico,
          vh.placas,

          origen.id_lugares AS id_origen,
          origen.nombre AS origen,
          origen.direccion AS origen_direccion,

          destino.id_lugares AS id_destino,
          destino.nombre AS destino,
          destino.direccion AS destino_direccion,

          ev.id_estado_viaje,
          ev.nombre AS estado

        FROM viajes v

        INNER JOIN conductores c
          ON c.id_conductores =
             v.id_conductores

        INNER JOIN vehiculos vh
          ON vh.id_vehiculos =
             v.id_vehiculos

        INNER JOIN lugares origen
          ON origen.id_lugares =
             v.id_origen

        INNER JOIN lugares destino
          ON destino.id_lugares =
             v.id_destino

        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje =
             v.id_estado_viaje

        WHERE v.id_viajes = $1
        LIMIT 1
      `,
      [idViaje]
    );

  const trip =
    tripResult.rows[0];

  if (!trip) {
    return null;
  }

  const locationsResult =
    await databasePool.query(
      `
        SELECT *
        FROM ubicaciones_viaje
        WHERE id_viajes = $1
        ORDER BY
          fecha_gps ASC,
          id_ubicaciones_viaje ASC
      `,
      [idViaje]
    );

  return {
    trip,
    locations:
      locationsResult.rows
  };
}

export async function deleteAdminTrip(
  idViaje
) {
  const client =
    await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult =
      await client.query(
        `
          SELECT
            id_viajes,
            folio
          FROM viajes
          WHERE id_viajes = $1
          LIMIT 1
          FOR UPDATE
        `,
        [idViaje]
      );

    const trip =
      tripResult.rows[0];

    if (!trip) {
      await client.query("ROLLBACK");

      return null;
    }

    const locationsResult =
      await client.query(
        `
          DELETE FROM ubicaciones_viaje
          WHERE id_viajes = $1
        `,
        [idViaje]
      );

    await client.query(
      `
        DELETE FROM viajes
        WHERE id_viajes = $1
      `,
      [idViaje]
    );

    await client.query("COMMIT");

    return {
      idViaje:
        Number(trip.id_viajes),

      folio:
        trip.folio,

      ubicacionesEliminadas:
        locationsResult.rowCount
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
