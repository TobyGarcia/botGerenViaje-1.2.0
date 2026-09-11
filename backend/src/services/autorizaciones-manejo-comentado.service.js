import { databasePool } from "../database/pool.js";

export async function requestManejoComentadoAuthorization({ idViaje, idConductor }) {
  const result = await databasePool.query(
    `INSERT INTO autorizaciones_manejo_comentado_viaje (
       id_viajes, id_conductores, estado, motivo_solicitud
     )
     VALUES ($1, $2, 'PENDIENTE', 'Manejo comentado vencido o no registrado al intentar iniciar el viaje.')
     ON CONFLICT (id_viajes) DO NOTHING
     RETURNING id_autorizacion, estado, solicitado_en`,
    [idViaje, idConductor]
  );
  return result.rows[0] ?? null;
}

export async function listPendingManejoComentadoAuthorizations() {
  const result = await databasePool.query(
    `SELECT a.id_autorizacion, a.id_viajes, a.id_conductores, a.estado,
       a.motivo_solicitud, a.solicitado_en, v.folio, c.nombre AS conductor,
       vh.nombre AS vehiculo, vh.numero_economico, c.fecha_manejo_comentado
     FROM autorizaciones_manejo_comentado_viaje a
     INNER JOIN viajes v ON v.id_viajes = a.id_viajes
     INNER JOIN conductores c ON c.id_conductores = a.id_conductores
     INNER JOIN vehiculos vh ON vh.id_vehiculos = v.id_vehiculos
     WHERE a.estado = 'PENDIENTE'
     ORDER BY a.solicitado_en ASC`,
  );
  return result.rows;
}

export async function decideManejoComentadoAuthorization({ idAutorizacion, idUsuarioAdmin, approved, comentario, firma }) {
  const result = await databasePool.query(
    `UPDATE autorizaciones_manejo_comentado_viaje
     SET estado = $1, id_usuario_autorizador = $2, comentario_resolucion = $3,
       firma_autorizador = $4, resuelto_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_autorizacion = $5 AND estado = 'PENDIENTE'
     RETURNING id_autorizacion, id_viajes, id_conductores, estado, comentario_resolucion`,
    [approved ? 'APROBADA' : 'RECHAZADA', idUsuarioAdmin, comentario || null, firma || null, idAutorizacion]
  );
  return result.rows[0] ?? null;
}

export async function getManejoComentadoAuthorizationTripData(idAutorizacion) {
  const result = await databasePool.query(
    `SELECT a.id_autorizacion, a.estado, a.id_viajes, a.id_conductores,
       v.folio, c.nombre AS conductor, vh.nombre AS vehiculo, ut.telegram_user_id
     FROM autorizaciones_manejo_comentado_viaje a
     INNER JOIN viajes v ON v.id_viajes = a.id_viajes
     INNER JOIN conductores c ON c.id_conductores = a.id_conductores
     INNER JOIN vehiculos vh ON vh.id_vehiculos = v.id_vehiculos
     LEFT JOIN usuarios_telegram ut ON ut.id_conductores = a.id_conductores
     WHERE a.id_autorizacion = $1`,
    [idAutorizacion]
  );
  return result.rows[0] ?? null;
}
