import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {databasePool as db} from '../database/pool.js';
import {isManagementRole,managementTripSql} from './management-trip-scope.js';
import {ROLES_SUPERVISOR_Y_SUPERIOR} from '../middlewares/admin-auth.middleware.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function registerApproverDevice(user){
 const id=randomUUID(),secret=randomBytes(32).toString('hex');
 const cursor=(await db.query('SELECT COALESCE(MAX(id_evento),0)::text AS cursor FROM aprobador_eventos')).rows[0].cursor;
 await db.query('INSERT INTO aprobador_dispositivos(id_dispositivo,id_usuario,secreto_hash,push_cursor) VALUES($1,$2,$3,$4)',[id,user.id_usuarios_admin,hash(secret),cursor]);
 return {deviceId:id,deviceSecret:secret,cursor};
}
export async function approverDevice(id,secret){
 if(!/^[a-f0-9-]{36}$/i.test(String(id))||! /^[a-f0-9]{64}$/.test(String(secret)))return null;
 const result=await db.query(`UPDATE aprobador_dispositivos d SET ultimo_acceso=CURRENT_TIMESTAMP FROM usuarios_admin u
 WHERE d.id_dispositivo=$1 AND d.secreto_hash=$2 AND NOT d.revocado AND u.id_usuarios_admin=d.id_usuario AND u.activo
 RETURNING u.id_usuarios_admin,u.rol`,[id,hash(secret)]);
 const user=result.rows[0];return user&&ROLES_SUPERVISOR_Y_SUPERIOR.includes(user.rol)?user:null;
}
export async function revokeApproverDevice(id,secret){
 const user=await approverDevice(id,secret);if(!user)return false;
 await db.query('UPDATE aprobador_dispositivos SET revocado=TRUE WHERE id_dispositivo=$1',[id]);return true;
}
export async function approverFeed(user,cursor='0',queryDb=db){
 if(!/^\d{1,18}$/.test(String(cursor)))throw Error('Cursor inválido');
 const watermark=(await queryDb.query('SELECT COALESCE(MAX(id_evento),0)::text AS cursor FROM aprobador_eventos')).rows[0].cursor;
 const scope=isManagementRole(user.rol)?`AND ${managementTripSql('v')}`:'';
 const events=(await queryDb.query(`SELECT e.id_evento::text AS id,e.id_viajes::text AS "tripId",v.folio,e.categoria,e.estado,
 CASE WHEN e.categoria='management' AND e.estado='PENDIENTE' THEN EXISTS(SELECT 1 FROM gerenciamiento_viajes g WHERE g.id_gerenciamiento=e.entidad AND g.estado='PENDIENTE')
 WHEN e.categoria='inspection' AND e.estado='PENDIENTE_APROBACION' THEN EXISTS(SELECT 1 FROM inspecciones_vehiculares i WHERE i.id_inspeccion=e.entidad AND i.estado='PENDIENTE_APROBACION') ELSE FALSE END AS actionable,
 c.nombre AS conductor,vh.nombre AS unidad,origen.nombre AS origen,destino.nombre AS destino,
 CASE WHEN e.categoria='stop' THEN uv.nombre_punto ELSE NULL END AS detalle
 FROM aprobador_eventos e JOIN viajes v ON v.id_viajes=e.id_viajes
 LEFT JOIN conductores c ON c.id_conductores=v.id_conductores LEFT JOIN vehiculos vh ON vh.id_vehiculos=v.id_vehiculos
 LEFT JOIN lugares origen ON origen.id_lugares=v.id_origen LEFT JOIN lugares destino ON destino.id_lugares=v.id_destino
 LEFT JOIN ubicaciones_viaje uv ON e.categoria='stop' AND uv.id_ubicaciones_viaje=e.entidad
 WHERE e.id_evento>$1 AND e.id_evento<=$2 ${scope} ORDER BY e.id_evento LIMIT 50`,[cursor,watermark])).rows;
 // Return the last delivered ID; never skip the rest of a large batch.
 const next=events.length===50?events.at(-1).id:watermark;
 const critical=(await queryDb.query(`SELECT v.id_viajes::text AS "tripId",v.folio,
 EXISTS(SELECT 1 FROM gerenciamiento_viajes g WHERE g.id_viaje=v.id_viajes) AS "fueraEstado"
 FROM viajes v WHERE ${managementTripSql('v')} AND (
 EXISTS(SELECT 1 FROM gerenciamiento_viajes g WHERE g.id_viaje=v.id_viajes AND g.estado='PENDIENTE') OR
 EXISTS(SELECT 1 FROM inspecciones_vehiculares i WHERE i.estado='PENDIENTE_APROBACION' AND (i.id_viajes=v.id_viajes OR EXISTS(
 SELECT 1 FROM viaje_inspeccion_uso u WHERE u.id_viajes=v.id_viajes AND u.id_inspeccion=i.id_inspeccion))))
 ORDER BY v.id_viajes DESC`)).rows;
 return {events,cursor:next,critical,polledAt:new Date().toISOString()};
}

export async function bindApproverToken(deviceId,secret,token){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token))throw Error('Token inválido');
 const user=await approverDevice(deviceId,secret);if(!user)throw Error('Dispositivo no autorizado');
 const client=await db.connect();try{await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[token]);
 await client.query('UPDATE aprobador_dispositivos SET revocado=TRUE,fcm_token=NULL WHERE fcm_token=$1 AND id_dispositivo<>$2',[token,deviceId]);
 await client.query('UPDATE aprobador_dispositivos SET fcm_token=$1,critical_hash=CASE WHEN fcm_token IS DISTINCT FROM $1 THEN NULL ELSE critical_hash END,reintentar_en=NULL,fallos=0 WHERE id_dispositivo=$2 AND NOT revocado',[token,deviceId]);
 await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
