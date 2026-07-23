import { databasePool } from "../database/pool.js";

export async function saveTripLocation({
  idViaje,
  latitude,
  longitude,
  accuracy,
  speed,
  heading,
  gpsTimestamp
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          ev.nombre AS estado
        FROM viajes v

        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje =
             v.id_estado_viaje

        WHERE v.id_viajes = $1

        LIMIT 1
        FOR UPDATE OF v
      `,
      [idViaje]
    );

    const trip = tripResult.rows[0];

    if (!trip) {
      throw new Error("El viaje no existe.");
    }

    if (trip.estado !== "EN_CURSO") {
      throw new Error(
        `No se pueden registrar ubicaciones en un viaje con estado ${trip.estado}.`
      );
    }

    const locationResult = await client.query(
      `
        INSERT INTO ubicaciones_viaje (
          id_viajes,
          latitud,
          longitud,
          precision_metros,
          velocidad,
          direccion,
          fecha_gps
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING
          id_ubicaciones_viaje,
          id_viajes,
          latitud,
          longitud,
          precision_metros,
          velocidad,
          direccion,
          fecha_gps,
          creado_en
      `,
      [
        idViaje,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        gpsTimestamp
      ]
    );

    await client.query("COMMIT");

    return {
      ...locationResult.rows[0],
      folio: trip.folio
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}