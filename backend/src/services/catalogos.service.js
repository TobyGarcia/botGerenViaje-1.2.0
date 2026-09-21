import { databasePool } from "../database/pool.js";

export async function getConductores() {
  const result = await databasePool.query(`
    SELECT
      id_conductores,
      nombre,
      empresa,
      licencia_numero,
      tipo_licencia,
      licencia_vigente,
      licencia_vencimiento,
      fecha_manejo_comentado,
      COALESCE(
        (
          SELECT 
            CASE 
              WHEN e.calificacion >= 85 THEN e.fecha_evaluacion >= CURRENT_DATE - INTERVAL '365 days'
              WHEN e.calificacion >= 75 THEN e.fecha_evaluacion >= CURRENT_DATE - INTERVAL '180 days'
              WHEN e.calificacion >= 50 THEN e.fecha_evaluacion >= CURRENT_DATE - INTERVAL '90 days'
              ELSE FALSE
            END
          FROM evaluaciones_manejo_comentado e
          WHERE e.id_conductores = conductores.id_conductores AND e.estado_evaluacion = 'APROBADO'
          ORDER BY e.fecha_evaluacion DESC
          LIMIT 1
        ),
        (fecha_manejo_comentado IS NOT NULL AND fecha_manejo_comentado >= CURRENT_DATE - INTERVAL '180 days'),
        FALSE
      ) AS manejo_comentado_vigente,
      telefono
    FROM conductores
    WHERE activo = TRUE


    ORDER BY nombre ASC
  `);

  return result.rows;
}

export async function getVehiculos() {
  const result = await databasePool.query(`
    SELECT
      v.id_vehiculos,
      v.nombre,
      v.marca,
      v.modelo,
      v.numero_economico,
      v.placas,
      v.kilometraje_actual,
      v.color,
      v.id_conductor_asignado,
      v.id_supervisor_asignado,
      COALESCE(s_asig.nombre, v.personal_asignado_nombre, c_asig.nombre) AS personal_asignado
    FROM vehiculos v
    LEFT JOIN conductores c_asig ON c_asig.id_conductores = v.id_conductor_asignado
    LEFT JOIN usuarios_admin s_asig ON s_asig.id_usuarios_admin = v.id_supervisor_asignado
    WHERE v.activo = TRUE
      AND v.en_mantenimiento = FALSE
      AND NOT EXISTS (
        SELECT 1
        FROM viajes viaje
        INNER JOIN estados_viaje estado
          ON estado.id_estado_viaje = viaje.id_estado_viaje
        WHERE viaje.id_vehiculos = v.id_vehiculos
          AND estado.nombre = 'EN_CURSO'
      )
    ORDER BY v.marca ASC, v.modelo ASC, v.nombre ASC
  `);

  return result.rows;
}

export async function getLugares() {
  const result = await databasePool.query(`
    SELECT
      id_lugares,
      nombre,
      direccion,
      latitud,
      longitud,
      COALESCE(es_favorito, FALSE) AS es_favorito
    FROM lugares
    WHERE activo = TRUE
    ORDER BY es_favorito DESC, nombre ASC
  `);

  return result.rows;
}

export async function createLugar({ nombre, direccion = "" }) {
  const normalizedNombre = String(nombre || "").trim();
  const normalizedDireccion = String(direccion || "").trim();

  if (!normalizedNombre) {
    throw new Error("El nombre del destino es obligatorio.");
  }

  const existing = await databasePool.query(
    `SELECT id_lugares, nombre, direccion, activo FROM lugares WHERE LOWER(nombre) = LOWER($1) AND activo = TRUE LIMIT 1`,
    [normalizedNombre]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await databasePool.query(
    `INSERT INTO lugares (nombre, direccion, activo) VALUES ($1, $2, TRUE) RETURNING id_lugares, nombre, direccion, activo`,
    [normalizedNombre, normalizedDireccion]
  );

  return result.rows[0];
}

export async function getEstadosViaje() {
  const result = await databasePool.query(`
    SELECT
      id_estado_viaje,
      nombre,
      descripcion
    FROM estados_viaje
    WHERE activo = TRUE
    ORDER BY id_estado_viaje ASC
  `);

  return result.rows;
}
