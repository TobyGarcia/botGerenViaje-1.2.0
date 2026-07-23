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