import {databasePool as db} from '../database/pool.js';
export async function driverInspectionRejections(idConductor,idInspeccion=null){
 return (await db.query(`SELECT i.id_inspeccion,i.actualizado_en,
 decision.id_evento::text AS rechazo_evento_id,COALESCE(decision.creado_en,i.aprobado_en,i.creado_en) AS rechazado_en,
 i.comentario_aprobacion AS motivo,vh.nombre AS vehiculo,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('folio',v.folio,'estado',e.nombre) ORDER BY v.id_viajes)
 FROM viajes v JOIN estados_viaje e USING(id_estado_viaje)
 WHERE v.id_conductores=i.id_conductores AND v.id_vehiculos=i.id_vehiculos
 AND (v.id_viajes=i.id_viajes OR EXISTS(SELECT 1 FROM viaje_inspeccion_uso u WHERE u.id_viajes=v.id_viajes AND u.id_inspeccion=i.id_inspeccion))
 AND (e.nombre='EN_CURSO' OR (e.nombre='CANCELADO' AND EXISTS(SELECT 1 FROM historial_estados_viaje h WHERE h.id_viajes=v.id_viajes AND h.observaciones LIKE 'Inspección #'||i.id_inspeccion||' rechazada.%')))), '[]'::jsonb) AS viajes
 FROM inspecciones_vehiculares i JOIN vehiculos vh USING(id_vehiculos)
 LEFT JOIN LATERAL(SELECT e.id_evento,e.creado_en FROM aprobador_eventos e
 WHERE e.id_viajes=i.id_viajes AND e.categoria='inspection' AND e.entidad=i.id_inspeccion AND e.estado='RECHAZADA'
 ORDER BY e.id_evento DESC LIMIT 1) decision ON TRUE
 WHERE i.id_conductores=$1 AND i.estado='RECHAZADA' AND ($2::bigint IS NULL OR i.id_inspeccion=$2)
 AND ($2::bigint IS NOT NULL OR NOT EXISTS(SELECT 1 FROM inspecciones_vehiculares nueva
 WHERE nueva.id_conductores=i.id_conductores AND nueva.id_vehiculos=i.id_vehiculos
 AND nueva.id_inspeccion>i.id_inspeccion AND nueva.estado IN ('PENDIENTE_APROBACION','APROBADA')))
 ORDER BY COALESCE(decision.creado_en,i.aprobado_en,i.creado_en) DESC,i.id_inspeccion DESC LIMIT 1`,[idConductor,idInspeccion])).rows;
}
export function rejectionMessage(n){
 const running=n.viajes.filter(t=>t.estado==='EN_CURSO').map(t=>t.folio);
 const cancelled=n.viajes.filter(t=>t.estado==='CANCELADO').map(t=>t.folio);
 return ['❌ Inspección vehicular rechazada',`Inspección: #${n.id_inspeccion}`,`Unidad: ${n.vehiculo}`,`Motivo: ${n.motivo||'Sin comentario del aprobador.'}`,
 ...(running.length?[`Puedes terminar tu viaje en curso: ${running.join(', ')}.`]:[]),
 ...(cancelled.length?[`Viajes pendientes cancelados: ${cancelled.join(', ')}.`]:[]),
 'Para tu siguiente viaje debes realizar una inspección nueva.','Los viajes finalizados conservan su historial.'].join('\n');
}
