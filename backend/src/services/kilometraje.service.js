function mileageError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function registerMileageReading({
  client,
  idVehiculo,
  kilometraje,
  tipoRegistro,
  origen,
  idViaje = null,
  observaciones = null,
  idUsuarioAdmin = null,
  idRegistroCorregido = null,
  fechaLectura = null,
  allowLower = false
}) {
  const latestResult = await client.query(
    `SELECT kilometraje
       FROM historial_kilometraje_vehiculos
      WHERE id_vehiculos = $1
      ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC
      LIMIT 1
      FOR UPDATE`,
    [idVehiculo]
  );

  const latest = latestResult.rows[0];
  if (!allowLower && latest && kilometraje < Number(latest.kilometraje)) {
    throw mileageError(
      `El kilometraje no puede ser menor a la última lectura registrada (${latest.kilometraje} km).`,
      "MILEAGE_DECREASE"
    );
  }

  const result = await client.query(
    `INSERT INTO historial_kilometraje_vehiculos (
       id_vehiculos, id_viajes, kilometraje, tipo_registro, origen,
       observaciones, id_usuarios_admin, id_registro_corregido, fecha_lectura
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamp, CURRENT_TIMESTAMP))
     RETURNING *`,
    [
      idVehiculo, idViaje, kilometraje, tipoRegistro, origen,
      observaciones, idUsuarioAdmin, idRegistroCorregido, fechaLectura
    ]
  );

  await client.query(
    `UPDATE vehiculos
        SET kilometraje_actual = GREATEST(kilometraje_actual, $1),
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_vehiculos = $2`,
    [kilometraje, idVehiculo]
  );

  return result.rows[0];
}
