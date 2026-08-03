import { databasePool } from "../database/pool.js";

export async function getConductores() {
  const result = await databasePool.query(`
    SELECT
      id_conductores,
      nombre,
      licencia_numero,
      licencia_vigente,
      licencia_vencimiento,
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
      id_vehiculos,
      nombre,
      marca,
      modelo,
      numero_economico,
      placas,
      kilometraje_actual
    FROM vehiculos
    WHERE activo = TRUE
      AND en_mantenimiento = FALSE
      AND NOT EXISTS (
        SELECT 1
        FROM viajes viaje
        INNER JOIN estados_viaje estado
          ON estado.id_estado_viaje = viaje.id_estado_viaje
        WHERE viaje.id_vehiculos = vehiculos.id_vehiculos
          AND estado.nombre = 'EN_CURSO'
      )
    ORDER BY marca ASC, modelo ASC, nombre ASC
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
