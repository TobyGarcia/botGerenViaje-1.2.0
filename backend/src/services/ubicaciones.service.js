import { databasePool } from "../database/pool.js";

export async function saveTripLocation({
  idViaje,
  latitude,
  longitude,
  accuracy,
  speed,
  heading,
  gpsTimestamp,
  esPuntoIntermedio = false,
  nombrePunto = null
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
          fecha_gps,
          es_punto_intermedio,
          nombre_punto
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
          $9
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
          es_punto_intermedio,
          nombre_punto,
          creado_en
      `,
      [
        idViaje,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        gpsTimestamp,
        Boolean(esPuntoIntermedio),
        nombrePunto ? String(nombrePunto).trim().slice(0, 150) : null
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

export async function saveIntermediatePoint({
  idViaje,
  idConductor,
  latitude,
  longitude,
  accuracy = null,
  speed = null,
  heading = null,
  gpsTimestamp = new Date(),
  nombrePunto = "Punto Intermedio"
}) {
  const client = await databasePool.connect();
  try {
    const tripRes = await client.query(
      `SELECT v.id_viajes, v.id_conductores, ev.nombre AS estado FROM viajes v INNER JOIN estados_viaje ev ON ev.id_estado_viaje = v.id_estado_viaje WHERE v.id_viajes = $1 LIMIT 1`,
      [idViaje]
    );
    const trip = tripRes.rows[0];
    if (!trip) throw new Error("El viaje no existe.");
    if (idConductor && Number(trip.id_conductores) !== Number(idConductor)) {
      throw new Error("El viaje no pertenece al conductor autenticado.");
    }
    if (trip.estado !== "EN_CURSO") {
      throw new Error("Solo se pueden registrar puntos intermedios en viajes en curso.");
    }
  } finally {
    client.release();
  }

  return saveTripLocation({
    idViaje,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    gpsTimestamp,
    esPuntoIntermedio: true,
    nombrePunto: nombrePunto || "Punto Intermedio"
  });
}

export async function saveTripLocationBatch({
  idViaje,
  idConductor,
  locations
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.id_conductores,
          v.hora_salida,
          v.hora_llegada,
          ev.nombre AS estado
        FROM viajes v
        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje = v.id_estado_viaje
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

    if (Number(trip.id_conductores) !== Number(idConductor)) {
      throw new Error("El viaje no pertenece al conductor autenticado.");
    }

    if (!["EN_CURSO", "FINALIZADO"].includes(trip.estado)) {
      throw new Error(`No se pueden registrar ubicaciones en un viaje con estado ${trip.estado}.`);
    }

    const now = Date.now();
    const startLimit = trip.hora_salida
      ? new Date(trip.hora_salida).getTime() - 24 * 60 * 60 * 1000
      : now - 24 * 60 * 60 * 1000;
    const endLimit = trip.hora_llegada
      ? new Date(trip.hora_llegada).getTime() + 10 * 60 * 1000
      : now + 10 * 60 * 1000;

    if (locations.some((location) => {
      const timestamp = location.fechaGps.getTime();
      return timestamp < startLimit || timestamp > endLimit;
    })) {
      throw new Error("La fecha GPS está fuera del periodo permitido del viaje.");
    }

    let inserted = 0;

    for (const location of locations) {
      const result = await client.query(
        `
          INSERT INTO ubicaciones_viaje (
            id_viajes,
            client_location_id,
            latitud,
            longitud,
            precision_metros,
            velocidad,
            direccion,
            fecha_gps,
            es_punto_intermedio,
            nombre_punto
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id_viajes, client_location_id)
            WHERE client_location_id IS NOT NULL
            DO NOTHING
          RETURNING id_ubicaciones_viaje
        `,
        [
          idViaje,
          location.clientLocationId,
          location.latitud,
          location.longitud,
          location.precisionMetros,
          location.velocidad,
          location.direccion,
          location.fechaGps,
          Boolean(location.esPuntoIntermedio || location.es_punto_intermedio),
          location.nombrePunto || location.nombre_punto || null
        ]
      );

      inserted += result.rowCount;
    }

    await client.query("COMMIT");

    return {
      inserted,
      duplicates: locations.length - inserted
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
