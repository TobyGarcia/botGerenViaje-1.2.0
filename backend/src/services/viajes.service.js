import { databasePool } from "../database/pool.js";

function buildTripFolio(sequenceNumber) {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const sequence = String(sequenceNumber).padStart(4, "0");

  return `VJ-${year}${month}${day}-${sequence}`;
}

export async function createTrip({
  idConductor,
  idVehiculo,
  idOrigen,
  idDestino,
  acompanantes,
  kilometrajeInicial,
  motivo
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const conductorResult = await client.query(
      `
        SELECT
          id_conductores,
          nombre,
          licencia_vigente
        FROM conductores
        WHERE id_conductores = $1
          AND activo = TRUE
        LIMIT 1
      `,
      [idConductor]
    );

    const conductor = conductorResult.rows[0];

    if (!conductor) {
      throw new Error("El conductor no existe o está inactivo.");
    }

    const vehicleResult = await client.query(
      `
        SELECT
          id_vehiculos,
          nombre,
          numero_economico,
          kilometraje_actual
        FROM vehiculos
        WHERE id_vehiculos = $1
          AND activo = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [idVehiculo]
    );

    const vehicle = vehicleResult.rows[0];

    if (!vehicle) {
      throw new Error("El vehículo no existe o está inactivo.");
    }

    const placesResult = await client.query(
      `
        SELECT id_lugares
        FROM lugares
        WHERE id_lugares = ANY($1::INTEGER[])
          AND activo = TRUE
      `,
      [[idOrigen, idDestino]]
    );

    if (placesResult.rowCount !== 2) {
      throw new Error(
        "El origen o el destino no existe o está inactivo."
      );
    }

    if (idOrigen === idDestino) {
      throw new Error(
        "El lugar de origen y destino deben ser diferentes."
      );
    }

    const stateResult = await client.query(
      `
        SELECT id_estado_viaje
        FROM estados_viaje
        WHERE nombre = 'PENDIENTE'
          AND activo = TRUE
        LIMIT 1
      `
    );

    const pendingState = stateResult.rows[0];

    if (!pendingState) {
      throw new Error(
        "No se encontró el estado PENDIENTE."
      );
    }

    const dailyCountResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM viajes
        WHERE fecha = CURRENT_DATE
      `
    );

    const dailySequence =
      dailyCountResult.rows[0].total + 1;

    const folio = buildTripFolio(dailySequence);

    const tripResult = await client.query(
      `
        INSERT INTO viajes (
          folio,
          id_conductores,
          id_vehiculos,
          id_origen,
          id_destino,
          id_estado_viaje,
          acompanantes,
          licencia_vigente,
          kilometraje_inicial,
          motivo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::JSONB,
          $8,
          $9,
          $10
        )
        RETURNING
          id_viajes,
          folio,
          fecha,
          id_estado_viaje,
          creado_en
      `,
      [
        folio,
        idConductor,
        idVehiculo,
        idOrigen,
        idDestino,
        pendingState.id_estado_viaje,
        JSON.stringify(acompanantes),
        conductor.licencia_vigente,
        kilometrajeInicial,
        motivo
      ]
    );

    const trip = tripResult.rows[0];

    await client.query(
      `
        INSERT INTO historial_estados_viaje (
          id_viajes,
          id_estado_anterior,
          id_estado_nuevo,
          observaciones
        )
        VALUES (
          $1,
          NULL,
          $2,
          'Viaje creado'
        )
      `,
      [
        trip.id_viajes,
        pendingState.id_estado_viaje
      ]
    );

    await client.query("COMMIT");

    return {
      ...trip,
      conductor: conductor.nombre,
      vehiculo: vehicle.nombre,
      numeroEconomico: vehicle.numero_economico,
      licenciaVigente: conductor.licencia_vigente
    };
    
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function startTrip({
  idViaje
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          v.id_conductores,
          v.id_vehiculos,
          v.id_estado_viaje,
          v.hora_salida,
          v.licencia_vigente,
          v.kilometraje_inicial,

          c.nombre AS conductor,
          c.activo AS conductor_activo,
          c.licencia_vigente AS licencia_actual_vigente,

          vh.nombre AS vehiculo,
          vh.numero_economico,
          vh.activo AS vehiculo_activo,

          ev.nombre AS estado
        FROM viajes v

        INNER JOIN conductores c
          ON c.id_conductores = v.id_conductores

        INNER JOIN vehiculos vh
          ON vh.id_vehiculos = v.id_vehiculos

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

    if (trip.estado !== "PENDIENTE") {
      throw new Error(
        `El viaje no puede iniciarse desde el estado ${trip.estado}.`
      );
    }

    if (!trip.conductor_activo) {
      throw new Error(
        "El conductor asignado está inactivo."
      );
    }

    if (!trip.licencia_actual_vigente) {
      throw new Error(
        "La licencia actual del conductor no está vigente."
      );
    }

    if (!trip.vehiculo_activo) {
      throw new Error(
        "El vehículo asignado está inactivo."
      );
    }

    const activeTripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.folio
        FROM viajes v

        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje = v.id_estado_viaje

        WHERE v.id_vehiculos = $1
          AND ev.nombre = 'EN_CURSO'
          AND v.id_viajes <> $2

        LIMIT 1
      `,
      [
        trip.id_vehiculos,
        idViaje
      ]
    );

    if (activeTripResult.rowCount > 0) {
      throw new Error(
        `El vehículo ya está asignado al viaje ${activeTripResult.rows[0].folio}.`
      );
    }

    const stateResult = await client.query(
      `
        SELECT
          id_estado_viaje
        FROM estados_viaje
        WHERE nombre = 'EN_CURSO'
          AND activo = TRUE
        LIMIT 1
      `
    );

    const activeState = stateResult.rows[0];

    if (!activeState) {
      throw new Error(
        "No se encontró el estado EN_CURSO."
      );
    }

    const updateResult = await client.query(
      `
        UPDATE viajes
        SET
          id_estado_viaje = $1,
          hora_salida = CURRENT_TIMESTAMP,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id_viajes = $2
        RETURNING
          id_viajes,
          folio,
          id_estado_viaje,
          hora_salida,
          kilometraje_inicial,
          actualizado_en
      `,
      [
        activeState.id_estado_viaje,
        idViaje
      ]
    );

    const updatedTrip = updateResult.rows[0];

    await client.query(
      `
        INSERT INTO historial_estados_viaje (
          id_viajes,
          id_estado_anterior,
          id_estado_nuevo,
          observaciones
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
      `,
      [
        idViaje,
        trip.id_estado_viaje,
        activeState.id_estado_viaje,
        "Viaje iniciado"
      ]
    );

    await client.query("COMMIT");

    return {
      idViaje: updatedTrip.id_viajes,
      folio: updatedTrip.folio,
      estado: "EN_CURSO",
      horaSalida: updatedTrip.hora_salida,
      kilometrajeInicial:
        updatedTrip.kilometraje_inicial,
      conductor: trip.conductor,
      vehiculo: trip.vehiculo,
      numeroEconomico:
        trip.numero_economico
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}