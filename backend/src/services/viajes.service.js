import { databasePool } from "../database/pool.js";
import { registerMileageReading } from "./kilometraje.service.js";

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

    await registerMileageReading({
      client,
      idVehiculo,
      idViaje: trip.id_viajes,
      kilometraje: kilometrajeInicial,
      tipoRegistro: "INICIAL_VIAJE",
      origen: "MINI_APP",
      observaciones: `Kilometraje inicial del viaje ${trip.folio}.`
    });

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
          v.acompanantes,
          v.motivo,

          c.nombre AS conductor,
          c.activo AS conductor_activo,
          c.licencia_vigente AS licencia_actual_vigente,

          vh.nombre AS vehiculo,
          vh.numero_economico,
          vh.activo AS vehiculo_activo,

          origen.nombre AS origen,
          destino.nombre AS destino,

          ev.nombre AS estado
        FROM viajes v

        INNER JOIN conductores c
          ON c.id_conductores = v.id_conductores

        INNER JOIN vehiculos vh
          ON vh.id_vehiculos = v.id_vehiculos

        INNER JOIN lugares origen
          ON origen.id_lugares = v.id_origen

        INNER JOIN lugares destino
          ON destino.id_lugares = v.id_destino

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
      licenciaVigente:
        trip.licencia_vigente,
      acompanantes:
        trip.acompanantes,
      motivo:
        trip.motivo,
      origen:
        trip.origen,
      destino:
        trip.destino,
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
export async function finishTrip({
  idViaje,
  kilometrajeFinal
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          v.id_vehiculos,
          v.id_estado_viaje,
          v.kilometraje_inicial,
          v.hora_salida,

          ev.nombre AS estado,

          vh.nombre AS vehiculo,
          vh.numero_economico,
          vh.kilometraje_actual,

          c.nombre AS conductor
        FROM viajes v

        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje =
             v.id_estado_viaje

        INNER JOIN vehiculos vh
          ON vh.id_vehiculos =
             v.id_vehiculos

        INNER JOIN conductores c
          ON c.id_conductores = v.id_conductores

        WHERE v.id_viajes = $1

        LIMIT 1
        FOR UPDATE OF v, vh
      `,
      [idViaje]
    );

    const trip = tripResult.rows[0];

    if (!trip) {
      throw new Error("El viaje no existe.");
    }

    if (trip.estado !== "EN_CURSO") {
      throw new Error(
        `El viaje no puede finalizarse desde el estado ${trip.estado}.`
      );
    }

    const initialMileage =
      Number(trip.kilometraje_inicial);

    if (kilometrajeFinal <= initialMileage) {
      throw new Error(
        "El kilometraje final debe ser mayor al kilometraje inicial."
      );
    }

    const kilometersTraveled =
      kilometrajeFinal - initialMileage;

    const stateResult = await client.query(
      `
        SELECT
          id_estado_viaje
        FROM estados_viaje
        WHERE nombre = 'FINALIZADO'
          AND activo = TRUE
        LIMIT 1
      `
    );

    const finishedState = stateResult.rows[0];

    if (!finishedState) {
      throw new Error(
        "No se encontró el estado FINALIZADO."
      );
    }

    const updateTripResult = await client.query(
      `
        UPDATE viajes
        SET
          id_estado_viaje = $1,
          kilometraje_final = $2,
          kilometros_recorridos = $3,
          hora_llegada = CURRENT_TIMESTAMP,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id_viajes = $4
        RETURNING
          id_viajes,
          folio,
          kilometraje_inicial,
          kilometraje_final,
          kilometros_recorridos,
          hora_salida,
          hora_llegada,
          actualizado_en
      `,
      [
        finishedState.id_estado_viaje,
        kilometrajeFinal,
        kilometersTraveled,
        idViaje
      ]
    );

    const updatedTrip =
      updateTripResult.rows[0];

    await client.query(
      `
        UPDATE vehiculos
        SET
          kilometraje_actual = GREATEST(
            kilometraje_actual,
            $1
          ),
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id_vehiculos = $2
      `,
      [
        kilometrajeFinal,
        trip.id_vehiculos
      ]
    );

    await registerMileageReading({
      client,
      idVehiculo: trip.id_vehiculos,
      idViaje,
      kilometraje: kilometrajeFinal,
      tipoRegistro: "FINAL_VIAJE",
      origen: "MINI_APP",
      observaciones: `Kilometraje final del viaje ${trip.folio}.`
    });

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
        finishedState.id_estado_viaje,
        "Viaje finalizado"
      ]
    );

    await client.query("COMMIT");

    return {
      idViaje:
        updatedTrip.id_viajes,

      folio:
        updatedTrip.folio,

      estado:
        "FINALIZADO",

      kilometrajeInicial:
        updatedTrip.kilometraje_inicial,

      kilometrajeFinal:
        updatedTrip.kilometraje_final,

      kilometrosRecorridos:
        updatedTrip.kilometros_recorridos,

      horaSalida:
        updatedTrip.hora_salida,

      horaLlegada:
        updatedTrip.hora_llegada,

      vehiculo:
        trip.vehiculo,

      conductor:
        trip.conductor,

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
export async function cancelTrip({ idViaje }) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      `
        SELECT
          v.id_viajes,
          v.folio,
          v.id_estado_viaje,
          v.hora_salida,
          ev.nombre AS estado,
          c.nombre AS conductor,
          vh.nombre AS vehiculo,
          vh.numero_economico
        FROM viajes v
        INNER JOIN estados_viaje ev
          ON ev.id_estado_viaje = v.id_estado_viaje
        INNER JOIN conductores c
          ON c.id_conductores = v.id_conductores
        INNER JOIN vehiculos vh
          ON vh.id_vehiculos = v.id_vehiculos

        INNER JOIN lugares origen
          ON origen.id_lugares = v.id_origen

        INNER JOIN lugares destino
          ON destino.id_lugares = v.id_destino
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

    if (!["PENDIENTE", "EN_CURSO"].includes(trip.estado)) {
      throw new Error(
        `El viaje no puede cancelarse desde el estado ${trip.estado}.`
      );
    }

    const stateResult = await client.query(
      `
        SELECT id_estado_viaje
        FROM estados_viaje
        WHERE nombre = 'CANCELADO'
          AND activo = TRUE
        LIMIT 1
      `
    );

    const cancelledState = stateResult.rows[0];

    if (!cancelledState) {
      throw new Error("No se encontró el estado CANCELADO.");
    }

    const updateResult = await client.query(
      `
        UPDATE viajes
        SET
          id_estado_viaje = $1,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id_viajes = $2
        RETURNING id_viajes, folio, hora_salida, actualizado_en
      `,
      [cancelledState.id_estado_viaje, idViaje]
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
        VALUES ($1, $2, $3, $4)
      `,
      [
        idViaje,
        trip.id_estado_viaje,
        cancelledState.id_estado_viaje,
        "Viaje cancelado"
      ]
    );

    await client.query("COMMIT");

    return {
      idViaje: updatedTrip.id_viajes,
      folio: updatedTrip.folio,
      estado: "CANCELADO",
      horaSalida: updatedTrip.hora_salida,
      conductor: trip.conductor,
      vehiculo: trip.vehiculo,
      numeroEconomico: trip.numero_economico
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveTrip({ idConductor }) {
  const result = await databasePool.query(
    `
      SELECT
        v.id_viajes,
        v.folio,
        v.fecha,
        v.acompanantes,
        v.licencia_vigente,
        v.kilometraje_inicial,
        v.kilometraje_final,
        v.kilometros_recorridos,
        v.motivo,
        v.hora_salida,
        v.hora_llegada,
        v.creado_en,
        v.actualizado_en,

        c.id_conductores,
        c.nombre AS conductor,
        c.licencia_numero,
        c.licencia_vigente AS licencia_actual_vigente,

        vh.id_vehiculos,
        vh.nombre AS vehiculo,
        vh.numero_economico,
        vh.placas,
        vh.kilometraje_actual,

        origen.id_lugares AS id_origen,
        origen.nombre AS origen,

        destino.id_lugares AS id_destino,
        destino.nombre AS destino,

        ev.id_estado_viaje,
        ev.nombre AS estado,

        ultima_ubicacion.latitud,
        ultima_ubicacion.longitud,
        ultima_ubicacion.precision_metros,
        ultima_ubicacion.velocidad,
        ultima_ubicacion.direccion,
        ultima_ubicacion.fecha_gps,
        ultima_ubicacion.creado_en
          AS ubicacion_creada_en

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

      LEFT JOIN LATERAL (
        SELECT
          u.latitud,
          u.longitud,
          u.precision_metros,
          u.velocidad,
          u.direccion,
          u.fecha_gps,
          u.creado_en
        FROM ubicaciones_viaje u
        WHERE u.id_viajes =
              v.id_viajes
        ORDER BY
          u.id_ubicaciones_viaje DESC
        LIMIT 1
      ) ultima_ubicacion
        ON TRUE

      WHERE v.id_conductores = $1
        AND ev.nombre IN (
        'PENDIENTE',
        'EN_CURSO'
      )

      ORDER BY
        CASE
          WHEN ev.nombre = 'EN_CURSO'
            THEN 1
          ELSE 2
        END,
        v.id_viajes DESC

      LIMIT 1
    `
    ,
    [idConductor]
  );

  return result.rows[0] ?? null;
}
export async function getTripById({
  idViaje
}) {
  const result = await databasePool.query(
    `
      SELECT
        v.id_viajes,
        v.folio,
        v.fecha,
        v.acompanantes,
        v.licencia_vigente,
        v.kilometraje_inicial,
        v.kilometraje_final,
        v.kilometros_recorridos,
        v.motivo,
        v.hora_salida,
        v.hora_llegada,
        v.creado_en,
        v.actualizado_en,

        c.id_conductores,
        c.nombre AS conductor,
        c.licencia_numero,

        vh.id_vehiculos,
        vh.nombre AS vehiculo,
        vh.numero_economico,
        vh.placas,
        vh.kilometraje_actual,

        origen.id_lugares AS id_origen,
        origen.nombre AS origen,

        destino.id_lugares AS id_destino,
        destino.nombre AS destino,

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

  return result.rows[0] ?? null;
}
