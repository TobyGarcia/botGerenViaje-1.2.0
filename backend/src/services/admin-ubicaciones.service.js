import {
  databasePool
} from "../database/pool.js";

export async function listAdminTripLocations({
  search = "",
  status = "TODOS",
  idConductor = null
} = {}) {
  const normalizedSearch = String(search).trim();
  const normalizedStatus = String(status).trim().toUpperCase();
  const values = [];
  const conditions = [];

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    conditions.push(`
      (
        v.folio ILIKE $${values.length}
        OR c.nombre ILIKE $${values.length}
        OR vh.nombre ILIKE $${values.length}
        OR vh.numero_economico ILIKE $${values.length}
        OR o.nombre ILIKE $${values.length}
        OR d.nombre ILIKE $${values.length}
      )
    `);
  }

  if (normalizedStatus && normalizedStatus !== "TODOS") {
    values.push(normalizedStatus);
    conditions.push(`UPPER(ev.nombre) = $${values.length}`);
  }

  if (idConductor) {
    values.push(idConductor);
    conditions.push(`v.id_conductores = $${values.length}`);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await databasePool.query(
    `
      WITH gps_resumen AS (
        SELECT
          uv.id_viajes,
          COUNT(*)::INTEGER AS total_ubicaciones,
          MIN(uv.fecha_gps) AS primera_ubicacion_en,
          MAX(uv.fecha_gps) AS ultima_ubicacion_en
        FROM ubicaciones_viaje uv
        GROUP BY uv.id_viajes
      ),
      ultima_ubicacion AS (
        SELECT DISTINCT ON (uv.id_viajes)
          uv.id_viajes,
          uv.id_ubicaciones_viaje,
          uv.latitud,
          uv.longitud,
          uv.precision_metros,
          uv.velocidad,
          uv.direccion,
          uv.fecha_gps
        FROM ubicaciones_viaje uv
        ORDER BY
          uv.id_viajes,
          uv.fecha_gps DESC,
          uv.id_ubicaciones_viaje DESC
      )
      SELECT
        v.id_viajes,
        v.folio,
        v.fecha,
        v.hora_salida,
        v.hora_llegada,
        ev.nombre AS estado,
        c.id_conductores,
        c.nombre AS conductor,
        vh.id_vehiculos,
        vh.nombre AS vehiculo,
        vh.numero_economico,
        vh.placas,
        o.id_lugares AS origen_id,
        o.nombre AS origen,
        d.id_lugares AS destino_id,
        d.nombre AS destino,
        gr.total_ubicaciones,
        gr.primera_ubicacion_en,
        gr.ultima_ubicacion_en,
        uu.id_ubicaciones_viaje AS ultima_ubicacion_id,
        uu.latitud AS ultima_latitud,
        uu.longitud AS ultima_longitud,
        uu.precision_metros AS ultima_precision_metros,
        uu.velocidad AS ultima_velocidad,
        uu.direccion AS ultima_direccion_grados,
        uu.fecha_gps AS ultima_fecha_gps
      FROM gps_resumen gr
      INNER JOIN viajes v ON v.id_viajes = gr.id_viajes
      INNER JOIN conductores c ON c.id_conductores = v.id_conductores
      INNER JOIN vehiculos vh ON vh.id_vehiculos = v.id_vehiculos
      INNER JOIN lugares o ON o.id_lugares = v.id_origen
      INNER JOIN lugares d ON d.id_lugares = v.id_destino
      INNER JOIN estados_viaje ev
        ON ev.id_estado_viaje = v.id_estado_viaje
      INNER JOIN ultima_ubicacion uu
        ON uu.id_viajes = v.id_viajes
      ${whereClause}
      ORDER BY gr.ultima_ubicacion_en DESC, v.id_viajes DESC
    `,
    values
  );

  return result.rows;
}

export async function getAdminTripLocationDetail(idViaje, idConductor = null) {
  const tripResult = await databasePool.query(
    `
      SELECT
        v.id_viajes,
        v.folio,
        v.fecha,
        v.hora_salida,
        v.hora_llegada,
        v.motivo,
        ev.nombre AS estado,
        c.id_conductores,
        c.nombre AS conductor,
        vh.id_vehiculos,
        vh.nombre AS vehiculo,
        vh.numero_economico,
        vh.placas,
        o.id_lugares AS origen_id,
        o.nombre AS origen,
        o.direccion AS origen_direccion,
        d.id_lugares AS destino_id,
        d.nombre AS destino,
        d.direccion AS destino_direccion
      FROM viajes v
      INNER JOIN conductores c ON c.id_conductores = v.id_conductores
      INNER JOIN vehiculos vh ON vh.id_vehiculos = v.id_vehiculos
      INNER JOIN lugares o ON o.id_lugares = v.id_origen
      INNER JOIN lugares d ON d.id_lugares = v.id_destino
      INNER JOIN estados_viaje ev
        ON ev.id_estado_viaje = v.id_estado_viaje
      WHERE v.id_viajes = $1
        AND ($2::integer IS NULL OR v.id_conductores = $2)
      LIMIT 1
    `,
    [idViaje, idConductor]
  );

  const trip = tripResult.rows[0];
  if (!trip) {
    return null;
  }

  const locationsResult = await databasePool.query(
    `
      SELECT
        uv.id_ubicaciones_viaje,
        uv.id_viajes,
        uv.latitud,
        uv.longitud,
        uv.precision_metros,
        uv.velocidad,
        uv.direccion,
        uv.fecha_gps,
        uv.es_punto_intermedio,
        uv.nombre_punto,
        uv.creado_en
      FROM ubicaciones_viaje uv
      WHERE uv.id_viajes = $1
      ORDER BY uv.fecha_gps ASC, uv.id_ubicaciones_viaje ASC
    `,
    [idViaje]
  );

  return {
    trip,
    locations: locationsResult.rows
  };
}
