import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {initializeApp,cert}from'firebase-admin/app';
import {getMessaging}from'firebase-admin/messaging';
import {databasePool as db}from'../database/pool.js';
import {approverFeed}from'./approver-notifications.service.js';
import {ROLES_SUPERVISOR_Y_SUPERIOR}from'../middlewares/admin-auth.middleware.js';
let messaging,running=false;
export function getApproverMessaging(){
 if(messaging)return messaging;
 if(process.env.APPROVER_PUSH_ENABLED!=='true')return null;
 const credentials=JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
 if(credentials.project_id!=='gv-mobility-pruebas')throw Error('Proyecto push incorrecto');
 messaging=getMessaging(initializeApp({credential:cert(credentials)},'approver-testing'));return messaging;
}
const labels={inspection:{PENDIENTE_APROBACION:'Inspección por aprobar'},management:{PENDIENTE:'Gerenciamiento por aprobar'}};
export function pushSnapshot(deviceId,feed){
 const critical={count:feed.critical.length,folios:feed.critical.slice(0,3).map(v=>v.folio),managementCount:feed.critical.filter(v=>v.fueraEstado).length,managementFolios:feed.critical.filter(v=>v.fueraEstado).slice(0,3).map(v=>v.folio)};
 // Data-only removals never create a visible approval/rejection notification.
 const resolvedTrips=[...new Set(feed.events.filter(e=>e.resolved&&((['trip','withdrawal'].includes(e.categoria)&&e.estado==='CANCELADO')||(e.categoria==='management'&&['APROBADO','RECHAZADO'].includes(e.estado))||(e.categoria==='inspection'&&['APROBADA','RECHAZADA'].includes(e.estado)))).map(e=>String(e.tripId)))];
 const events=[];for(const event of feed.events){
  if(!['inspection','management'].includes(event.categoria))continue;
  if(events.length===10)break;
  const request=(event.categoria==='management'&&event.estado==='PENDIENTE')||(event.categoria==='inspection'&&event.estado==='PENDIENTE_APROBACION');
  const priority=feed.critical.some(trip=>String(trip.tripId)===String(event.tripId));
  // Consume obsolete events without displaying a new request after its decision.
  if(!request)continue;
  if(request&&(!event.actionable||(event.categoria==='management'&&!priority)))continue;
  const value={request,priority,id:event.id,tripId:event.tripId,category:event.categoria,state:event.estado,title:labels[event.categoria]?.[event.estado]||'Novedad de aprobación',body:[event.folio,event.conductor,event.unidad,event.detalle||`${event.origen||''} → ${event.destino||''}`].filter(Boolean).join(' · ').slice(0,240)};
  const candidate={deviceId,events:[...events,value],resolvedTrips,critical,updatedAt:feed.polledAt};
  if(Buffer.byteLength(JSON.stringify(candidate),'utf8')>3300)break;events.push(value);
 }
 return {deviceId,events,resolvedTrips,critical,updatedAt:feed.polledAt};
}
export async function deliverApproverPush({send}={}){
 const transport=send||getApproverMessaging()?.send.bind(getApproverMessaging());if(!transport||running)return 0;running=true;
 let lock,acquired=false,count=0;
 try{lock=await db.connect();acquired=(await lock.query('SELECT pg_try_advisory_lock(7846113) AS locked')).rows[0].locked;if(!acquired)return 0;
 const devices=(await lock.query(`SELECT d.*,u.rol FROM aprobador_dispositivos d JOIN usuarios_admin u ON u.id_usuarios_admin=d.id_usuario
 WHERE NOT d.revocado AND d.fcm_token IS NOT NULL AND u.activo AND u.rol=ANY($1::text[])
 AND (d.reintentar_en IS NULL OR d.reintentar_en<CURRENT_TIMESTAMP) ORDER BY d.envio_en NULLS FIRST LIMIT 30`,[ROLES_SUPERVISOR_Y_SUPERIOR])).rows;
 for(const device of devices){
  const feed=await approverFeed({rol:device.rol},String(device.push_cursor),lock);
  const payload=pushSnapshot(device.id_dispositivo,feed),criticalHash=createHash('sha256').update(JSON.stringify(payload.critical)).digest('hex');
  if(!payload.events.length&&!payload.resolvedTrips.length&&device.critical_hash===criticalHash){await lock.query('UPDATE aprobador_dispositivos SET push_cursor=$1,envio_en=CURRENT_TIMESTAMP WHERE id_dispositivo=$2',[feed.cursor,device.id_dispositivo]);continue;}
  try{
   // Re-check revocation before handing the message to FCM.
   const valid=await lock.query('SELECT 1 FROM aprobador_dispositivos WHERE id_dispositivo=$1 AND NOT revocado AND fcm_token=$2',[device.id_dispositivo,device.fcm_token]);if(!valid.rows.length)continue;
   await transport({token:device.fcm_token,data:{snapshot:JSON.stringify(payload)},android:{priority:payload.events.length||payload.resolvedTrips.length||payload.critical.count?'high':'normal',ttl:3600000}});
   const cursor=payload.events.length?payload.events.at(-1).id:feed.cursor;
   await lock.query('UPDATE aprobador_dispositivos SET push_cursor=$1,critical_hash=$2,envio_en=CURRENT_TIMESTAMP,fallos=0,reintentar_en=NULL WHERE id_dispositivo=$3',[cursor,criticalHash,device.id_dispositivo]);count++;
  }catch(error){
   if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await lock.query('UPDATE aprobador_dispositivos SET revocado=TRUE,fcm_token=NULL WHERE id_dispositivo=$1',[device.id_dispositivo]);
   else await lock.query("UPDATE aprobador_dispositivos SET fallos=fallos+1,reintentar_en=CURRENT_TIMESTAMP+INTERVAL '1 minute' WHERE id_dispositivo=$1",[device.id_dispositivo]);
  }
 }
 return count;
 }finally{try{if(acquired)await lock.query('SELECT pg_advisory_unlock(7846113)');}finally{lock?.release();running=false;}}
}
