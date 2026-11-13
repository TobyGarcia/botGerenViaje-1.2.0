import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {databasePool as db}from'../database/pool.js';
import {deliverApproverPush,pushSnapshot} from '../services/approver-push.service.js';
import {registerApproverDevice,bindApproverToken,approverDevice,revokeApproverDevice,approverFeed}from'../services/approver-notifications.service.js';
test('eventos de aprobadores: rol, deduplicación, resumen persistente y revocación',async()=>{
 const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Notificaciones prueba') RETURNING id_conductores")).rows[0].id_conductores;
 const car=(await db.query('INSERT INTO vehiculos(nombre,numero_economico) VALUES($1,$1) RETURNING id_vehiculos',[randomUUID()])).rows[0].id_vehiculos;
 const place=async()=>(await db.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares;
 const origin=await place(),destination=await place();
 const admin=(await db.query("INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,'GERENTE') RETURNING id_usuarios_admin",[driver])).rows[0].id_usuarios_admin;
 const manager={id_usuarios_admin:admin,rol:'GERENTE'};const device=await registerApproverDevice(manager);
 assert.equal((await approverDevice(device.deviceId,device.deviceSecret)).id_usuarios_admin,admin);
 assert.equal(await approverDevice(device.deviceId,'0'.repeat(64)),null);
 const trip=async(time)=>(await db.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo,hora_salida) VALUES($1,$2,$3,$4,$5,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='PENDIENTE'),100,TRUE,'Prueba',$6) RETURNING id_viajes`,[randomUUID().slice(0,28),driver,car,origin,destination,'2026-11-12 '+time])).rows[0].id_viajes;
 const normal=await trip('12:00'),late=await trip('19:00');
 await db.query("INSERT INTO inspecciones_vehiculares(id_viajes,id_vehiculos,id_conductores,fecha_operativa,combustible,firma_conductor,tipo_asignacion,estado) VALUES($1,$2,$3,'2026-11-12','F','firma','PERMANENTE','PENDIENTE_APROBACION')",[late,car,driver]);
 const first=await approverFeed(manager,device.cursor);assert.equal(first.events.some(e=>e.tripId===String(normal)),false);assert.equal(first.events.length,2);assert.equal(first.critical.length,1);assert.equal(first.critical[0].folio.length>0,true);
 const repeated=await approverFeed(manager,first.cursor);assert.equal(repeated.events.length,0);assert.equal(repeated.critical.length,1);
 await db.query("UPDATE inspecciones_vehiculares SET estado='APROBADA' WHERE id_viajes=$1",[late]);
 const decided=await approverFeed(manager,first.cursor);assert.equal(decided.events.length,1);assert.equal(decided.critical.length,0);
 await db.query("UPDATE inspecciones_vehiculares SET estado='APROBADA' WHERE id_viajes=$1",[late]);assert.equal((await approverFeed(manager,decided.cursor)).events.length,0);
 assert.equal((await approverFeed({rol:'SUPERVISOR'},device.cursor)).events.some(e=>e.tripId===String(normal)),true);
 const fakeToken='test_fcm_'+randomUUID();
 await bindApproverToken(device.deviceId,device.deviceSecret,fakeToken);
 const packets=[];const send=async packet=>{packets.push(JSON.parse(packet.data.snapshot));return 'mock-message';};
 assert.equal(await deliverApproverPush({send}),1);assert.equal(await deliverApproverPush({send}),0);
 await trip('20:00');
 assert.equal(await deliverApproverPush({send:async()=>{throw Object.assign(Error('offline'),{code:'messaging/server-unavailable'});}}),0);
 await db.query("UPDATE aprobador_dispositivos SET reintentar_en=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id_dispositivo=$1",[device.deviceId]);
 assert.equal(await deliverApproverPush({send}),1);assert.equal(packets.at(-1).events.length,1);assert.equal(await deliverApproverPush({send}),0);
 const newer=await registerApproverDevice(manager);await bindApproverToken(newer.deviceId,newer.deviceSecret,fakeToken);
 assert.equal(await approverDevice(device.deviceId,device.deviceSecret),null);
 await revokeApproverDevice(newer.deviceId,newer.deviceSecret);
 await revokeApproverDevice(device.deviceId,device.deviceSecret);assert.equal(await approverDevice(device.deviceId,device.deviceSecret),null);
});

test('push agrupa sin exceder el tamaño FCM y conserva las referencias sin GPS',()=>{
 const feed={events:Array.from({length:50},(_,i)=>({id:String(i+1),tripId:'1',categoria:'trip',estado:'EN_CURSO',folio:'VJ',conductor:'Á'.repeat(1000)})),critical:Array.from({length:500},()=>({folio:'VJ-PRUEBA'})),polledAt:new Date().toISOString()};
 const payload=pushSnapshot('device',feed);assert.ok(payload.events.length>0&&payload.events.length<50);assert.ok(Buffer.byteLength(JSON.stringify(payload))<=3300);assert.equal(payload.critical.count,500);assert.equal(payload.critical.folios.length,3);assert.equal(JSON.stringify(payload).includes('latitud'),false);
});

test('rutas de avisos exigen sesión para registrar y credencial de dispositivo para consultar',async()=>{
 const {default:express}=await import('express');const {default:router}=await import('../routes/approver-notifications.routes.js');const {createAdminSessionToken}=await import('../utils/admin-session.js');
 const app=express();app.use(express.json());app.use(router);const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/devices',{method:'POST'})).status,401);assert.equal((await fetch(base+'/feed')).status,401);
 const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Usuario avisos HTTP') RETURNING id_conductores")).rows[0].id_conductores;
 const id=(await db.query("INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,'SUPERVISOR') RETURNING id_usuarios_admin",[driver])).rows[0].id_usuarios_admin;
 const auth=createAdminSessionToken({id_usuarios_admin:id,rol:'SUPERVISOR'});
 const registration=await fetch(base+'/devices',{method:'POST',headers:{Authorization:`Bearer ${auth}`}});assert.equal(registration.status,200);
 const device=(await registration.json()).data;const headers={'X-Notification-Device':device.deviceId,'X-Notification-Key':device.deviceSecret};
 const response=await fetch(base+'/feed',{headers});assert.equal(response.status,200);const data=(await response.json()).data;assert.ok(data.critical);assert.equal(data.deviceId,device.deviceId);
 await db.query('UPDATE usuarios_admin SET activo=FALSE WHERE id_usuarios_admin=$1',[id]);assert.equal((await fetch(base+'/feed',{headers})).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
