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
 await db.query("INSERT INTO inspecciones_vehiculares(id_viajes,id_vehiculos,id_conductores,fecha_operativa,combustible,firma_conductor,tipo_asignacion,estado) VALUES($1,$2,$3,'2026-11-12','F','firma','PERMANENTE','PENDIENTE_APROBACION')",[normal,car,driver]);
 const first=await approverFeed(manager,device.cursor);assert.equal(first.events.some(e=>e.tripId===String(normal)),false);assert.equal(first.events.length,1);assert.equal(first.critical.length,1);assert.equal(first.critical[0].folio.length>0,true);
 const repeated=await approverFeed(manager,first.cursor);assert.equal(repeated.events.length,0);assert.equal(repeated.critical.length,1);
 await db.query("UPDATE inspecciones_vehiculares SET estado='APROBADA' WHERE id_viajes=$1",[late]);
 const backlog=await approverFeed(manager,device.cursor);assert.equal(backlog.events.find(e=>e.categoria==='inspection'&&e.estado==='PENDIENTE_APROBACION').actionable,false);assert.equal(pushSnapshot(device.deviceId,backlog).events.some(e=>e.state==='PENDIENTE_APROBACION'),false);
 const decided=await approverFeed(manager,first.cursor);assert.equal(decided.events.length,1);assert.equal(decided.critical.length,0);
 await db.query("UPDATE inspecciones_vehiculares SET estado='APROBADA' WHERE id_viajes=$1",[late]);assert.equal((await approverFeed(manager,decided.cursor)).events.length,0);
 assert.equal((await approverFeed({rol:'SUPERVISOR'},device.cursor)).events.some(e=>e.tripId===String(normal)),true);
 const fakeToken='test_fcm_'+randomUUID();
 await bindApproverToken(device.deviceId,device.deviceSecret,fakeToken);
 const packets=[];const send=async packet=>{packets.push(JSON.parse(packet.data.snapshot));return 'mock-message';};
 assert.equal(await deliverApproverPush({send}),1);assert.equal(packets.at(-1).events.length,0);assert.deepEqual(packets.at(-1).resolvedTrips,[String(late)]);assert.equal(await deliverApproverPush({send}),0);
 const g=(await db.query("INSERT INTO gerenciamiento_viajes(id_viaje,id_conductor,nivel_riesgo,estado) VALUES($1,$2,'BAJO','PENDIENTE') RETURNING id_gerenciamiento",[late,driver])).rows[0].id_gerenciamiento;
 const partial=pushSnapshot('test',await approverFeed(manager,device.cursor));assert.equal(partial.resolvedTrips.includes(String(late)),false);assert.equal(partial.events.some(e=>e.category==='management'&&e.request),true);
 assert.equal(await deliverApproverPush({send}),1);
 await db.query("UPDATE gerenciamiento_viajes SET estado='APROBADO' WHERE id_gerenciamiento=$1",[g]);
 assert.equal(await deliverApproverPush({send}),1);assert.equal(packets.at(-1).events.length,0);assert.deepEqual(packets.at(-1).resolvedTrips,[String(late)]);assert.equal(await deliverApproverPush({send}),0);
 const nextTrip=await trip('20:00');
 assert.equal(await deliverApproverPush({send}),0);
 await db.query("INSERT INTO inspecciones_vehiculares(id_viajes,id_vehiculos,id_conductores,fecha_operativa,combustible,firma_conductor,tipo_asignacion,estado) VALUES($1,$2,$3,'2026-11-12','F','firma','PERMANENTE','PENDIENTE_APROBACION')",[nextTrip,car,driver]);
 assert.equal(await deliverApproverPush({send:async()=>{throw Object.assign(Error('offline'),{code:'messaging/server-unavailable'});}}),0);
 await db.query("UPDATE aprobador_dispositivos SET reintentar_en=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id_dispositivo=$1",[device.deviceId]);
 assert.equal(await deliverApproverPush({send}),1);assert.equal(packets.at(-1).events.length,1);assert.equal(await deliverApproverPush({send}),0);
 for(const state of ['EN_CURSO','FINALIZADO','CANCELADO']){
  await db.query('UPDATE viajes SET id_estado_viaje=(SELECT id_estado_viaje FROM estados_viaje WHERE nombre=$1) WHERE id_viajes=$2',[state,nextTrip]);
  assert.equal(await deliverApproverPush({send}),0);
 }
 await db.query("UPDATE inspecciones_vehiculares SET estado='RECHAZADA' WHERE id_viajes=$1",[nextTrip]);
 assert.equal(await deliverApproverPush({send}),1);assert.equal(packets.at(-1).events.length,0);assert.deepEqual(packets.at(-1).resolvedTrips,[String(nextTrip)]);assert.equal(await deliverApproverPush({send}),0);
 assert.ok((await approverFeed({rol:'SUPERVISOR'},device.cursor)).events.every(e=>['inspection','management'].includes(e.categoria)));
 const newer=await registerApproverDevice(manager);await bindApproverToken(newer.deviceId,newer.deviceSecret,fakeToken);
 assert.equal(await approverDevice(device.deviceId,device.deviceSecret),null);
 await revokeApproverDevice(newer.deviceId,newer.deviceSecret);
 await revokeApproverDevice(device.deviceId,device.deviceSecret);assert.equal(await approverDevice(device.deviceId,device.deviceSecret),null);
});

test('push agrupa sin exceder el tamaño FCM y conserva las referencias sin GPS',()=>{
 const feed={events:Array.from({length:50},(_,i)=>({id:String(i+1),tripId:'1',categoria:'inspection',estado:'PENDIENTE_APROBACION',actionable:true,folio:'VJ',conductor:'Á'.repeat(1000)})),critical:Array.from({length:500},()=>({folio:'VJ-PRUEBA'})),polledAt:new Date().toISOString()};
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

test('el payload distingue gerenciamientos y sus pendientes sin reclasificar inspecciones',()=>{
 const feed={events:[{id:'1',tripId:'1',categoria:'management',estado:'PENDIENTE',folio:'VJ-1',actionable:true},{id:'2',tripId:'2',categoria:'inspection',estado:'PENDIENTE_APROBACION',folio:'VJ-2',actionable:true}],critical:[{tripId:'1',folio:'VJ-1',fueraEstado:true},{tripId:'2',folio:'VJ-2',fueraEstado:false}],polledAt:new Date().toISOString()};
 const value=pushSnapshot('test',feed);assert.equal(value.events[0].category,'management');assert.equal(value.events[0].state,'PENDIENTE');assert.equal(value.events[1].category,'inspection');assert.equal(value.critical.managementCount,1);assert.deepEqual(value.critical.managementFolios,['VJ-1']);
});

test('no reproduce solicitudes resueltas ni decisiones detrás de solicitudes antiguas',()=>{
 const feed={events:[...Array.from({length:12},(_,i)=>({id:String(i+1),tripId:'1',categoria:'management',estado:'PENDIENTE',actionable:false})),{id:'13',tripId:'1',categoria:'management',estado:'APROBADO'}],critical:[],polledAt:new Date().toISOString()};
 const payload=pushSnapshot('test',feed);assert.equal(payload.events.length,0);assert.equal(payload.critical.count,0);
});
test('una solicitud vigente se marca para avisar al llegar, la decisión no',()=>{
 const feed={events:[{id:'1',tripId:'1',categoria:'management',estado:'PENDIENTE',actionable:true},{id:'2',tripId:'2',categoria:'management',estado:'APROBADO'}],critical:[{tripId:'1',folio:'VJ-1',fueraEstado:true}],polledAt:new Date().toISOString()};
 const payload=pushSnapshot('test',feed);assert.equal(payload.events[0].request,true);assert.equal(payload.events[0].priority,true);assert.equal(payload.events.length,1);
});

test('solo envía solicitudes: omite ciclo de viaje, paradas y decisiones',()=>{
 const states=['PENDIENTE','EN_CURSO','FINALIZADO','CANCELADO'];
 const noise=Array.from({length:20},(_,i)=>({id:String(i+1),tripId:'1',categoria:'trip',estado:states[i%4]}));
 noise.push({id:'21',tripId:'1',categoria:'stop',estado:'PARADA_TECNICA'});
 const base={events:noise,critical:[],polledAt:new Date().toISOString()};
 assert.equal(pushSnapshot('test',base).events.length,0);
 const result=pushSnapshot('test',{...base,events:[...noise,{id:'22',tripId:'1',categoria:'management',estado:'APROBADO'}]});
 assert.equal(result.events.length,0);
});

test('aprobación y rechazo solo envían retiradas silenciosas y caben en el límite FCM',()=>{
 const events=Array.from({length:50},(_,i)=>({id:String(i+1),tripId:String(9000000000000000000n+BigInt(i)),categoria:i%2?'inspection':'management',estado:i%2?(i%4===1?'APROBADA':'RECHAZADA'):(i%4===0?'APROBADO':'RECHAZADO'),resolved:true}));
 const payload=pushSnapshot('test',{events,critical:[],polledAt:new Date().toISOString()});
 assert.equal(payload.events.length,0);assert.equal(payload.resolvedTrips.length,50);assert.ok(Buffer.byteLength(JSON.stringify(payload))<=3300);
});
