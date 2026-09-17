import { databasePool } from "../database/pool.js";

export class TurnosVehiculoError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "TurnosVehiculoError";
    this.statusCode = statusCode;
  }
}

export async function getSupervisorAssignedVehicleTurnStatus(idUsuarioAdmin) {
  if (!idUsuarioAdmin) {
    return { assigned: false, vehiculo: null, turnoActivo: null };
  }

  const vehiculoRes = await databasePool.query(
    `SELECT v.id_vehiculos, v.nombre, v.marca, v.modelo, v.numero_economico, v.placas, v.kilometraje_actual, v.id_supervisor_asignado
     FROM vehiculos v
     WHERE v.id_supervisor_asignado = $1 AND v.activo = TRUE
     LIMIT 1`,
    [idUsuarioAdmin]
  );

  const vehiculo = vehiculoRes.rows[0];
  if (!vehiculo) {
    return { assigned: false, vehiculo: null, turnoActivo: null };
  }

  const turnoRes = await databasePool.query(
    `SELECT id_turno_vehiculo, id_vehiculos, id_usuarios_admin, estado, odometro_final_turno, fecha_fin_turno, odometro_inicial_turno, fecha_inicio_turno, km_recorridos_casa, observaciones_fin, observaciones_inicio, creado_en
     FROM turnos_vehiculo
     WHERE id_vehiculos = $1
     ORDER BY id_turno_vehiculo DESC
     LIMIT 1`,
    [vehiculo.id_vehiculos]
  );

  return {
    assigned: true,
    vehiculo,
    turnoActivo: turnoRes.rows[0] || null
  };
}

export async function finalizeSupervisorShift({ idVehiculo, idUsuarioAdmin, odometroFinal, observaciones }) {
  const parsedOdometro = Number(odometroFinal);
  if (!Number.isInteger(parsedOdometro) || parsedOdometro < 0) {
    throw new TurnosVehiculoError("El odómetro final debe ser un número entero mayor o igual a 0.");
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    const vehiculoRes = await client.query(
      `SELECT id_vehiculos, nombre, numero_economico, kilometraje_actual, id_supervisor_asignado
       FROM vehiculos
       WHERE id_vehiculos = $1 AND activo = TRUE
       FOR UPDATE`,
      [idVehiculo]
    );

    const vehiculo = vehiculoRes.rows[0];
    if (!vehiculo) {
      throw new TurnosVehiculoError("El vehículo especificado no existe o está inactivo.", 44);
    }

    if (idUsuarioAdmin && String(vehiculo.id_supervisor_asignado) !== String(idUsuarioAdmin)) {
      throw new TurnosVehiculoError("No tienes asignado este vehículo como supervisor a cargo.", 403);
    }

    if (parsedOdometro < vehiculo.kilometraje_actual) {
      throw new TurnosVehiculoError(`El odómetro final (${parsedOdometro} km) no puede ser menor al kilometraje actual del vehículo (${vehiculo.kilometraje_actual} km).`);
    }

    const activeTurnRes = await client.query(
      `SELECT id_turno_vehiculo FROM turnos_vehiculo
       WHERE id_vehiculos = $1 AND estado = 'EN_TRASLADO_CASA'
       LIMIT 1`,
      [idVehiculo]
    );

    if (activeTurnRes.rows[0]) {
      throw new TurnosVehiculoError("El turno de este vehículo ya fue finalizado y la unidad se encuentra en traslado a domicilio.", 409);
    }

    const obsText = String(observaciones || "").trim();

    const insertTurnRes = await client.query(
      `INSERT INTO turnos_vehiculo (id_vehiculos, id_usuarios_admin, estado, odometro_final_turno, fecha_fin_turno, observaciones_fin)
       VALUES ($1, $2, 'EN_TRASLADO_CASA', $3, CURRENT_TIMESTAMP, $4)
       RETURNING *`,
      [idVehiculo, idUsuarioAdmin || null, parsedOdometro, obsText || null]
    );

    await client.query(
      `UPDATE vehiculos
       SET kilometraje_actual = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_vehiculos = $2`,
      [parsedOdometro, idVehiculo]
    );

    await client.query(
      `INSERT INTO historial_kilometraje_vehiculos (id_vehiculos, kilometraje, tipo_registro, origen, observaciones, id_usuarios_admin)
       VALUES ($1, $2, 'FINAL_TURNO', 'MINI_APP', $3, $4)`,
      [
        idVehiculo,
        parsedOdometro,
        `Finalización de turno / Salida a casa por supervisor. ${obsText ? `Obs: ${obsText}` : ""}`.trim(),
        idUsuarioAdmin || null
      ]
    );

    await client.query("COMMIT");

    return {
      success: true,
      turno: insertTurnRes.rows[0],
      vehiculo: {
        ...vehiculo,
        kilometraje_actual: parsedOdometro
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function startSupervisorShift({ idVehiculo, idUsuarioAdmin, odometroInicial, observaciones }) {
  const parsedOdometro = Number(odometroInicial);
  if (!Number.isInteger(parsedOdometro) || parsedOdometro < 0) {
    throw new TurnosVehiculoError("El odómetro inicial debe ser un número entero mayor o igual a 0.");
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    const vehiculoRes = await client.query(
      `SELECT id_vehiculos, nombre, numero_economico, kilometraje_actual, id_supervisor_asignado
       FROM vehiculos
       WHERE id_vehiculos = $1 AND activo = TRUE
       FOR UPDATE`,
      [idVehiculo]
    );

    const vehiculo = vehiculoRes.rows[0];
    if (!vehiculo) {
      throw new TurnosVehiculoError("El vehículo especificado no existe o está inactivo.", 404);
    }

    if (idUsuarioAdmin && String(vehiculo.id_supervisor_asignado) !== String(idUsuarioAdmin)) {
      throw new TurnosVehiculoError("No tienes asignado este vehículo como supervisor a cargo.", 403);
    }

    const activeTurnRes = await client.query(
      `SELECT * FROM turnos_vehiculo
       WHERE id_vehiculos = $1 AND estado = 'EN_TRASLADO_CASA'
       ORDER BY id_turno_vehiculo DESC
       LIMIT 1
       FOR UPDATE`,
      [idVehiculo]
    );

    const activeTurn = activeTurnRes.rows[0];
    if (!activeTurn) {
      throw new TurnosVehiculoError("La unidad no se encuentra registrada en traslado a casa. Primero debes finalizar el turno al salir de la base.", 409);
    }

    if (parsedOdometro < activeTurn.odometro_final_turno) {
      throw new TurnosVehiculoError(`El odómetro inicial al regresar a base (${parsedOdometro} km) no puede ser menor al odómetro registrado al salir (${activeTurn.odometro_final_turno} km).`);
    }

    const kmRecorridosCasa = parsedOdometro - activeTurn.odometro_final_turno;
    const obsText = String(observaciones || "").trim();

    const updateTurnRes = await client.query(
      `UPDATE turnos_vehiculo
       SET estado = 'EN_TURNO',
           odometro_inicial_turno = $1,
           fecha_inicio_turno = CURRENT_TIMESTAMP,
           km_recorridos_casa = $2,
           observaciones_inicio = $3,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id_turno_vehiculo = $4
       RETURNING *`,
      [parsedOdometro, kmRecorridosCasa, obsText || null, activeTurn.id_turno_vehiculo]
    );

    await client.query(
      `UPDATE vehiculos
       SET kilometraje_actual = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_vehiculos = $2`,
      [parsedOdometro, idVehiculo]
    );

    await client.query(
      `INSERT INTO historial_kilometraje_vehiculos (id_vehiculos, kilometraje, tipo_registro, origen, observaciones, id_usuarios_admin)
       VALUES ($1, $2, 'INICIAL_TURNO', 'MINI_APP', $3, $4)`,
      [
        idVehiculo,
        parsedOdometro,
        `Inicio de turno / Regreso a base por supervisor (${kmRecorridosCasa} km recorridos en traslado a casa). ${obsText ? `Obs: ${obsText}` : ""}`.trim(),
        idUsuarioAdmin || null
      ]
    );

    await client.query("COMMIT");

    return {
      success: true,
      turno: updateTurnRes.rows[0],
      vehiculo: {
        ...vehiculo,
        kilometraje_actual: parsedOdometro
      },
      kmRecorridosCasa
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSupervisorTurnHistory(idVehiculo, limit = 20) {
  const result = await databasePool.query(
    `SELECT tv.*, u.nombre AS supervisor_nombre
     FROM turnos_vehiculo tv
     LEFT JOIN usuarios_admin u ON u.id_usuarios_admin = tv.id_usuarios_admin
     WHERE tv.id_vehiculos = $1
     ORDER BY tv.id_turno_vehiculo DESC
     LIMIT $2`,
    [idVehiculo, limit]
  );
  return result.rows;
}
