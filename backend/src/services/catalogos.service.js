import { databasePool } from "../database/pool.js";

export async function getConductores() {
  const result = await databasePool.query(`
    SELECT
      id_conductores,
      nombre,
      licencia_numero,
      tipo_licencia,
      licencia_vigente,
      licencia_vencimiento,
      fecha_manejo_comentado,
      (fecha_manejo_comentado IS NOT NULL AND fecha_manejo_comentado >= CURRENT_DATE - INTERVAL '6 months') AS manejo_comentado_vigente,
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
      COALESCE(c_asig.nombre, s_asig.nombre, v.personal_asignado_nombre) AS personal_asignado
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
      longitud
    FROM lugares
    WHERE activo = TRUE
    ORDER BY nombre ASC
  `);

  return result.rows;
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
