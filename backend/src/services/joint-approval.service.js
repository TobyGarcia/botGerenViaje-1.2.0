import {nonCancelledTripSql,inspectionMatchesTripSql,inspectionAvailableSql} from './approval-eligibility.js';
import {databasePool as db}from'../database/pool.js';
import {canApproveRisk,requiredRiskRole}from'../utils/approval-policy.js';
const failure=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
export async function inspectionManagementContext(idInspection,queryDb=db){
 const rows=(await queryDb.query(`SELECT g.id_gerenciamiento,g.id_viaje,g.estado,g.nivel_riesgo,v.folio,
 (v.id_viajes=i.id_viajes) AS direct FROM inspecciones_vehiculares i
 JOIN viajes v ON ${nonCancelledTripSql('v')} AND ${inspectionMatchesTripSql('i','v')}
 JOIN gerenciamiento_viajes g ON g.id_viaje=v.id_viajes
 WHERE i.id_inspeccion=$1 AND g.estado IN ('PENDIENTE','APROBADO') AND (g.estado='PENDIENTE' OR v.id_viajes=i.id_viajes OR EXISTS(SELECT 1 FROM viaje_inspeccion_uso u WHERE u.id_viajes=v.id_viajes AND u.id_inspeccion=i.id_inspeccion)) ORDER BY direct DESC,g.id_gerenciamiento DESC`,[idInspection])).rows;
 const direct=rows.find(row=>row.direct);const pending=rows.filter(row=>row.estado==='PENDIENTE');
 return {management:direct|| (pending.length===1?pending[0]:pending.length===0&&rows.length===1?rows[0]:null),ambiguous:!direct&&pending.length>1};
}
export async function approveJointDocuments({idGerenciamiento=null,idInspeccion=null,idUsuarioAdmin,signature,comment=null}){
 if(!String(signature||'').startsWith('data:image/png;base64,'))throw failure('La firma del aprobador es obligatoria.',400);
 const client=await db.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(7846114)');
 const actor=(await client.query(`SELECT u.rol,c.nombre FROM usuarios_admin u JOIN conductores c ON c.id_conductores=u.id_conductores WHERE u.id_usuarios_admin=$1 AND u.activo`,[idUsuarioAdmin])).rows[0];
 if(!actor||!canApproveRisk(actor.rol,'BAJO'))throw failure('Aprobador no autorizado.',403);
 if(idInspeccion&&!idGerenciamiento){const context=await inspectionManagementContext(idInspeccion,client);if(context.ambiguous)throw failure('La inspección tiene varios gerenciamientos. Selecciona el viaje desde Gerenciamientos.');idGerenciamiento=context.management?.id_gerenciamiento;}
 let management=null,inspection=null,managementChanged=false,inspectionChanged=false;
 if(idGerenciamiento){
  management=(await client.query('SELECT * FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1 FOR UPDATE',[idGerenciamiento])).rows[0];
  if(!management)throw failure('Gerenciamiento no encontrado.',404);
  if(!canApproveRisk(actor.rol,management.nivel_riesgo))throw failure(`Riesgo ${management.nivel_riesgo}: requiere ${requiredRiskRole(management.nivel_riesgo)}.`,403);
  if(!['PENDIENTE','APROBADO'].includes(management.estado))throw failure('El gerenciamiento ya tiene una decisión registrada.');
  if(!management.id_viaje)throw failure('Falta vincular el viaje y su inspección.');
  const trip=(await client.query("SELECT v.*,ev.nombre AS trip_estado FROM viajes v JOIN estados_viaje ev USING(id_estado_viaje) WHERE v.id_viajes=$1 FOR UPDATE OF v",[management.id_viaje])).rows[0];
  if(trip?.trip_estado==='CANCELADO')throw failure('El viaje fue cancelado; su solicitud ya no puede aprobarse.');
  if(!trip||trip.id_conductores!==management.id_conductor)throw failure('El conductor del viaje no coincide con el documento.');
  const result=await client.query(`SELECT i.* FROM inspecciones_vehiculares i WHERE i.id_conductores=$2 AND i.id_vehiculos=$3 AND (
   i.id_viajes=$1 OR EXISTS(SELECT 1 FROM viaje_inspeccion_uso u WHERE u.id_viajes=$1 AND u.id_inspeccion=i.id_inspeccion)
   OR (i.fecha_operativa=(COALESCE($4::timestamp,$5::timestamp)+INTERVAL '2 hours')::date AND i.creado_en<=COALESCE($4::timestamp,$5::timestamp)
    AND i.estado IN ('PENDIENTE_APROBACION','APROBADA') AND NOT EXISTS(SELECT 1 FROM viajes other WHERE other.id_vehiculos=i.id_vehiculos AND other.id_conductores<>i.id_conductores AND other.hora_salida>i.creado_en AND other.hora_salida<COALESCE($4::timestamp,$5::timestamp))))
   ORDER BY (i.id_viajes=$1) DESC,i.id_inspeccion DESC LIMIT 1 FOR UPDATE`,[trip.id_viajes,trip.id_conductores,trip.id_vehiculos,trip.hora_salida,trip.creado_en]);
  inspection=result.rows[0];
  if(!inspection)throw failure('Primero debe enviarse la inspección vehicular para aprobar ambos documentos.');
  if(idInspeccion&&String(inspection.id_inspeccion)!==String(idInspeccion))throw failure('La inspección no corresponde al gerenciamiento seleccionado.');
  if(!['PENDIENTE_APROBACION','APROBADA'].includes(inspection.estado))throw failure('La inspección fue rechazada; requiere revisión.');
  if(management.estado==='APROBADO'&&inspection.estado==='APROBADA')throw failure('Este gerenciamiento ya tiene una decisión registrada.');
  await client.query('INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion) VALUES($1,$2) ON CONFLICT(id_viajes) DO NOTHING',[trip.id_viajes,inspection.id_inspeccion]);
  if(management.estado==='PENDIENTE'){
   management=(await client.query(`UPDATE gerenciamiento_viajes SET estado='APROBADO',id_usuario_autorizador=$1,nombre_autorizador_firma=$2,firma_autorizador=$3,fecha_firma_autorizador=CURRENT_TIMESTAMP,observaciones=COALESCE($4,observaciones),actualizado_en=CURRENT_TIMESTAMP WHERE id_gerenciamiento=$5 RETURNING *`,[idUsuarioAdmin,actor.nombre,signature,comment,idGerenciamiento])).rows[0];managementChanged=true;
  }
  const updated=await client.query(`UPDATE inspecciones_vehiculares SET estado='APROBADA',id_usuario_admin_aprobador=$1,firma_supervisor=$2,comentario_aprobacion=$3,aprobado_en=CURRENT_TIMESTAMP,actualizado_en=CURRENT_TIMESTAMP
   WHERE estado='PENDIENTE_APROBACION' AND id_conductores=$4 AND id_vehiculos=$5 AND fecha_operativa=$6 AND ${inspectionAvailableSql('inspecciones_vehiculares')} RETURNING *`,[idUsuarioAdmin,signature,comment,inspection.id_conductores,inspection.id_vehiculos,inspection.fecha_operativa]);
  inspectionChanged=updated.rows.length>0;inspection=updated.rows.find(row=>String(row.id_inspeccion)===String(inspection.id_inspeccion))||inspection;
 }else{
  const consumer=(await client.query(`SELECT active_trip.id_viajes FROM viajes active_trip JOIN inspecciones_vehiculares source ON source.id_inspeccion=$1 WHERE ${nonCancelledTripSql('active_trip')} AND ${inspectionMatchesTripSql('source','active_trip')} ORDER BY (active_trip.id_viajes=source.id_viajes) DESC,active_trip.id_viajes DESC LIMIT 1 FOR UPDATE OF active_trip`,[idInspeccion])).rows[0];
  if(!consumer&&(await client.query('SELECT 1 FROM inspecciones_vehiculares WHERE id_inspeccion=$1',[idInspeccion])).rows.length===0)throw failure('Inspección no encontrada.',404);
  if(!consumer)throw failure('La solicitud fue retirada porque su viaje está cancelado y no hay otro viaje válido que use la inspección.');
  inspection=(await client.query('SELECT * FROM inspecciones_vehiculares WHERE id_inspeccion=$1 FOR UPDATE',[idInspeccion])).rows[0];if(!inspection)throw failure('Inspección no encontrada.',404);
  if(inspection.estado!=='PENDIENTE_APROBACION')throw failure('La inspección ya fue atendida.');
  inspection=(await client.query(`UPDATE inspecciones_vehiculares SET estado='APROBADA',id_usuario_admin_aprobador=$1,firma_supervisor=$2,comentario_aprobacion=$3,aprobado_en=CURRENT_TIMESTAMP,actualizado_en=CURRENT_TIMESTAMP WHERE id_inspeccion=$4 RETURNING *`,[idUsuarioAdmin,signature,comment,idInspeccion])).rows[0];inspectionChanged=true;
 }
 await client.query('COMMIT');return {management,inspection,managementChanged,inspectionChanged};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
