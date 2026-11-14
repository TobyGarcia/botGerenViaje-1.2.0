import {inspectionAvailableSql, inspectionMatchesTripSql} from './approval-eligibility.js';

// The caller owns the transaction. Capture consumers before changing the state:
// daily fallback matching intentionally excludes rejected inspections.
export async function rejectSharedInspection(client, {idInspeccion,idUsuarioAdmin,comentario,firmaSupervisor=null}) {
 const inspection=(await client.query(`SELECT * FROM inspecciones_vehiculares i WHERE id_inspeccion=$1 AND estado='PENDIENTE_APROBACION' AND ${inspectionAvailableSql('i')} FOR UPDATE`,[idInspeccion])).rows[0];
 if(!inspection)return null;
 const consumers=(await client.query(`SELECT v.id_viajes,v.folio,v.id_estado_viaje,ev.nombre AS estado FROM viajes v JOIN estados_viaje ev USING(id_estado_viaje) JOIN inspecciones_vehiculares i ON i.id_inspeccion=$1 WHERE ${inspectionMatchesTripSql('i','v')} ORDER BY v.id_viajes FOR UPDATE OF v`,[idInspeccion])).rows;
 for(const trip of consumers){
  await client.query('INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion) VALUES($1,$2) ON CONFLICT(id_viajes) DO NOTHING',[trip.id_viajes,idInspeccion]);
 }
 const record=(await client.query(`UPDATE inspecciones_vehiculares SET estado='RECHAZADA',id_usuario_admin_aprobador=$2,comentario_aprobacion=$3,firma_supervisor=$4,aprobado_en=CURRENT_TIMESTAMP,actualizado_en=CURRENT_TIMESTAMP WHERE id_inspeccion=$1 RETURNING *`,[idInspeccion,idUsuarioAdmin,comentario||null,firmaSupervisor])).rows[0];
 const cancelled=[];
 for(const trip of consumers.filter(t=>t.estado==='EN_CURSO')){
  await client.query('INSERT INTO historial_estados_viaje(id_viajes,id_estado_anterior,id_estado_nuevo,observaciones) VALUES($1,NULL,$2,$3)',[trip.id_viajes,trip.id_estado_viaje,`Inspección #${idInspeccion} rechazada durante el recorrido. Se permite finalizar este viaje; los siguientes requieren una nueva inspección.${comentario?` Motivo: ${comentario}`:''}`]);
 }
 for(const trip of consumers.filter(t=>t.estado==='PENDIENTE')){
  const state=(await client.query("UPDATE viajes SET id_estado_viaje=(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='CANCELADO' AND activo),actualizado_en=CURRENT_TIMESTAMP WHERE id_viajes=$1 RETURNING id_estado_viaje",[trip.id_viajes])).rows[0];
  await client.query('INSERT INTO historial_estados_viaje(id_viajes,id_estado_anterior,id_estado_nuevo,observaciones) VALUES($1,$2,$3,$4)',[trip.id_viajes,trip.id_estado_viaje,state.id_estado_viaje,`Inspección #${idInspeccion} rechazada.${comentario?` Motivo: ${comentario}`:''}`]);
  cancelled.push({idViaje:trip.id_viajes,folio:trip.folio,estado:'CANCELADO'});
 }
 return {...record,cancelledTrips:cancelled};
}
