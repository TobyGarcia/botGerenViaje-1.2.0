import { databasePool } from "../database/pool.js";

const mexicoNowSql = "(timezone('America/Mexico_City', CURRENT_TIMESTAMP))";
const operationalDateSql = `(${mexicoNowSql} + INTERVAL '2 hours')`;

export async function getInspectionContext({ idViaje, idConductor }) {
  const result = await databasePool.query(`
    SELECT v.id_viajes, v.folio, v.fecha, v.kilometraje_inicial, c.id_conductores,
      c.nombre AS conductor, c.licencia_numero, c.tipo_licencia, c.licencia_vigente,
      c.licencia_vencimiento, vh.id_vehiculos, vh.marca, vh.modelo,
      vh.nombre AS vehiculo, vh.tipo_vehiculo, vh.numero_poliza, vh.seguro_vencimiento,
      vh.numero_economico, vh.numero_serie, vh.placas,
      COALESCE(ultima.kilometraje, vh.kilometraje_actual) AS kilometraje_actual,
      i.id_inspeccion, i.estado, i.combustible, i.tipo_asignacion, i.asignacion_inicio,
      i.asignacion_fin, i.danos, i.checklist, i.observaciones_conductor, i.firma_conductor
    FROM viajes v
    INNER JOIN conductores c ON c.id_conductores = v.id_conductores
    INNER JOIN vehiculos vh ON vh.id_vehiculos = v.id_vehiculos
    LEFT JOIN LATERAL (
      SELECT kilometraje FROM historial_kilometraje_vehiculos
      WHERE id_vehiculos = vh.id_vehiculos ORDER BY fecha_lectura DESC, id_historial_kilometraje DESC LIMIT 1
    ) ultima ON TRUE
    LEFT JOIN inspecciones_vehiculares i ON i.id_viajes = v.id_viajes
    WHERE v.id_viajes = $1 AND c.id_conductores = $2
    LIMIT 1`, [idViaje, idConductor]);
  return result.rows[0] ?? null;
}

export async function saveInspection({ idViaje, idConductor, data }) {
  const context = await getInspectionContext({ idViaje, idConductor });
  if (!context) throw new Error("El viaje no pertenece al conductor autenticado.");
  if (context.estado === "APROBADA") throw new Error("La inspección ya fue aprobada y no puede modificarse.");
  const isNextDay = Boolean(data.esDiaSiguiente);
  const now = await databasePool.query(
    isNextDay
      ? `SELECT (${mexicoNowSql} + INTERVAL '1 day')::date AS fecha, EXTRACT(HOUR FROM ${mexicoNowSql}) AS hora`
      : `SELECT ${operationalDateSql}::date AS fecha, EXTRACT(HOUR FROM ${mexicoNowSql}) AS hora`
  );
  const { fecha, hora } = now.rows[0];
  const result = await databasePool.query(`
    INSERT INTO inspecciones_vehiculares (
      id_viajes, id_vehiculos, id_conductores, fecha_operativa, combustible,
      tipo_asignacion, asignacion_inicio, asignacion_fin, danos, checklist,
      observaciones_conductor, firma_conductor, estado, requiere_autorizacion_fuera_horario,
      es_dia_siguiente, actualizado_en
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,'PENDIENTE_APROBACION',$13,$14,CURRENT_TIMESTAMP)
    ON CONFLICT (id_viajes) DO UPDATE SET fecha_operativa=EXCLUDED.fecha_operativa,
      combustible=EXCLUDED.combustible,
      tipo_asignacion=EXCLUDED.tipo_asignacion, asignacion_inicio=EXCLUDED.asignacion_inicio,
      asignacion_fin=EXCLUDED.asignacion_fin, danos=EXCLUDED.danos, checklist=EXCLUDED.checklist,
      observaciones_conductor=EXCLUDED.observaciones_conductor, firma_conductor=EXCLUDED.firma_conductor,
      estado='PENDIENTE_APROBACION', requiere_autorizacion_fuera_horario=EXCLUDED.requiere_autorizacion_fuera_horario,
      es_dia_siguiente=EXCLUDED.es_dia_siguiente, actualizado_en=CURRENT_TIMESTAMP
    RETURNING *`, [idViaje, context.id_vehiculos, idConductor, fecha, data.combustible,
      data.tipoAsignacion, data.asignacionInicio || null, data.asignacionFin || null,
      JSON.stringify(data.danos || {}), JSON.stringify(data.checklist || {}),
      data.observaciones || null, data.firma, Number(hora) < 7 || Number(hora) >= 16, isNextDay]);
  return result.rows[0];
}

export async function getApprovalForStart(idViaje, idConductor) {
  const result = await databasePool.query(`
    SELECT i.estado, i.id_inspeccion, i.es_dia_siguiente
    FROM viajes v
    LEFT JOIN inspecciones_vehiculares i
      ON i.id_vehiculos = v.id_vehiculos
      AND i.id_conductores = $2
      AND (
        i.fecha_operativa = ${operationalDateSql}::date
        OR i.fecha_operativa = CURRENT_DATE
        OR (i.es_dia_siguiente = TRUE AND i.fecha_operativa >= CURRENT_DATE - INTERVAL '1 day')
      )
      AND i.estado = 'APROBADA'
    WHERE v.id_viajes = $1
    ORDER BY i.aprobado_en DESC NULLS LAST LIMIT 1`, [idViaje, idConductor]);
  return result.rows[0] ?? null;
}

export async function getInspectionRequirement({ idViaje, idConductor }) {
  const context = await getInspectionContext({ idViaje, idConductor });
  if (!context) return null;
  // La aprobación es por conductor/usuario y fecha operativa, no por unidad.
  // Un segundo conductor que tome el mismo vehículo debe inspeccionarlo.
  const approved = await getApprovalForStart(idViaje, idConductor);
  return {
    required: !approved?.id_inspeccion,
    approved: Boolean(approved?.id_inspeccion),
    inspection: context.id_inspeccion ? {
      idInspeccion: context.id_inspeccion,
      estado: context.estado,
      esDiaSiguiente: Boolean(context.es_dia_siguiente)
    } : null,
    context
  };
}

export async function listPendingInspections() {
  const result = await databasePool.query(`
    SELECT i.id_inspeccion, i.estado, i.creado_en, i.requiere_autorizacion_fuera_horario,
      i.fecha_operativa, i.es_dia_siguiente,
      v.folio, c.nombre AS conductor, vh.nombre AS vehiculo, vh.numero_economico
    FROM inspecciones_vehiculares i
    INNER JOIN viajes v ON v.id_viajes=i.id_viajes
    INNER JOIN conductores c ON c.id_conductores=i.id_conductores
    INNER JOIN vehiculos vh ON vh.id_vehiculos=i.id_vehiculos
    ORDER BY CASE WHEN i.estado='PENDIENTE_APROBACION' THEN 0 ELSE 1 END, i.creado_en DESC`);
  return result.rows;
}

export async function getAdminInspection(idInspeccion) {
  const result = await databasePool.query(`
    SELECT i.id_inspeccion, i.id_viajes, i.id_vehiculos, i.id_conductores,
      i.fecha_operativa, i.es_dia_siguiente, i.combustible, i.tipo_asignacion, i.asignacion_inicio,
      i.asignacion_fin, i.danos, i.checklist, i.observaciones_conductor,
      i.firma_conductor, i.firma_supervisor, i.estado, i.requiere_autorizacion_fuera_horario,
      i.comentario_aprobacion, i.aprobado_en, i.pdf_generado_en, i.pdf_nombre,
      i.creado_en, i.actualizado_en, v.folio, v.kilometraje_inicial, c.nombre AS conductor,
      c.licencia_numero, c.tipo_licencia, c.licencia_vigente, c.licencia_vencimiento,
      vh.nombre AS vehiculo, vh.marca, vh.modelo, vh.tipo_vehiculo,
      vh.numero_economico, vh.placas, vh.numero_serie, vh.numero_poliza,
      vh.seguro_vencimiento, ua.nombre AS aprobador
    FROM inspecciones_vehiculares i
    INNER JOIN viajes v ON v.id_viajes=i.id_viajes
    INNER JOIN conductores c ON c.id_conductores=i.id_conductores
    INNER JOIN vehiculos vh ON vh.id_vehiculos=i.id_vehiculos
    LEFT JOIN usuarios_admin ua ON ua.id_usuarios_admin=i.id_usuario_admin_aprobador
    WHERE i.id_inspeccion=$1 LIMIT 1`, [idInspeccion]);
  return result.rows[0] ?? null;
}

export async function countPendingInspections() {
  const result = await databasePool.query("SELECT COUNT(*)::INTEGER AS total FROM inspecciones_vehiculares WHERE estado='PENDIENTE_APROBACION'");
  return result.rows[0].total;
}

export async function approveInspection({ idInspeccion, idUsuarioAdmin, approved, comentario, firmaSupervisor = null }) {
  const result = await databasePool.query(`
    UPDATE inspecciones_vehiculares
    SET estado=$1, id_usuario_admin_aprobador=$2, comentario_aprobacion=$3, firma_supervisor=$4,
      aprobado_en=CURRENT_TIMESTAMP, actualizado_en=CURRENT_TIMESTAMP
    WHERE id_inspeccion=$5 AND estado='PENDIENTE_APROBACION'
    RETURNING *`, [approved ? "APROBADA" : "RECHAZADA", idUsuarioAdmin, comentario || null, firmaSupervisor, idInspeccion]);
  return result.rows[0] ?? null;
}

export async function storeInspectionPdf({ idInspeccion, nombre, document }) {
  await databasePool.query(`UPDATE inspecciones_vehiculares SET pdf_nombre=$1, pdf_documento=$2, pdf_generado_en=CURRENT_TIMESTAMP WHERE id_inspeccion=$3`, [nombre, document, idInspeccion]);
}

export async function updateInspectionSharePointDetails({ idInspeccion, webUrl, itemId }) {
  await databasePool.query(
    `UPDATE inspecciones_vehiculares
     SET sharepoint_web_url=$1, sharepoint_item_id=$2, sharepoint_subido_en=CURRENT_TIMESTAMP
     WHERE id_inspeccion=$3`,
    [webUrl, itemId, idInspeccion]
  );
}

export async function getStoredInspectionPdf(idInspeccion) {
  const result = await databasePool.query("SELECT pdf_nombre, pdf_documento, sharepoint_web_url FROM inspecciones_vehiculares WHERE id_inspeccion=$1", [idInspeccion]);
  return result.rows[0] ?? null;
}

