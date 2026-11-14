import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databasePool as db} from '../database/pool.js';
import {approverFeed} from '../services/approver-notifications.service.js';
import {pushSnapshot} from '../services/approver-push.service.js';
import {requestManejoComentadoAuthorization,decideManejoComentadoAuthorization,listPendingManejoComentadoAuthorizations} from '../services/autorizaciones-manejo-comentado.service.js';
import {canAuthorizeManejo} from '../utils/manejo-authorization-policy.js';

test('manejo: solo gerente/administrador, incluso local diurno; deduplicación, decisiones y cancelación silenciosas',async()=>{
 const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Manejo push prueba') RETURNING id_conductores")).rows[0].id_conductores;
 const car=(await db.query('INSERT INTO vehiculos(nombre,numero_economico) VALUES($1,$1) RETURNING id_vehiculos',[randomUUID()])).rows[0].id_vehiculos;
 const place=(await db.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares;
 const destination=(await db.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares;
 const admin=(await db.query("INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,'GERENTE') RETURNING id_usuarios_admin",[driver])).rows[0].id_usuarios_admin;
 const createTrip=async()=>(await db.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo,hora_salida)
  VALUES($1,$2,$3,$4,$5,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='PENDIENTE'),100,TRUE,'Manejo prueba','2026-11-14 12:00') RETURNING id_viajes`,[randomUUID().slice(0,28),driver,car,place,destination])).rows[0].id_viajes;
 const cursor=(await approverFeed({rol:'GERENTE'})).cursor;
 const trip=await createTrip();
 const request=await requestManejoComentadoAuthorization({idViaje:trip,idConductor:driver});
 assert.equal(await requestManejoComentadoAuthorization({idViaje:trip,idConductor:driver}),null);
 for(const role of ['GERENTE','GERENTE_GENERAL','ADMINISTRADOR']){
  assert.equal(canAuthorizeManejo(role),true);
  const feed=await approverFeed({rol:role},cursor),payload=pushSnapshot('test',feed);
  assert.equal(payload.events.filter(e=>e.category==='manejo').length,1);
  const event=payload.events.find(e=>e.category==='manejo');assert.equal(event.request,true);assert.equal(event.priority,false);assert.match(event.title,/Manejo comentado/);assert.match(event.body,/vencido o no registrado/);
  assert.equal(feed.critical.some(e=>e.tripId===String(trip)),false);
  assert.equal((await approverFeed({rol:role},feed.cursor)).events.length,0);
 }
 for(const role of ['SUPERVISOR','QHSE','INSTRUCTOR','COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE']){
  assert.equal(canAuthorizeManejo(role),false);assert.equal((await approverFeed({rol:role},cursor)).events.some(e=>e.categoria==='manejo'),false);
 }
 const first=await approverFeed({rol:'GERENTE'},cursor);
 await decideManejoComentadoAuthorization({idAutorizacion:request.id_autorizacion,idUsuarioAdmin:admin,approved:true,firma:'data:image/png;base64,test'});
 const resolved=pushSnapshot('test',await approverFeed({rol:'GERENTE'},first.cursor));assert.equal(resolved.events.length,0);assert.deepEqual(resolved.resolvedManejoTrips,[String(trip)]);
 assert.equal(pushSnapshot('test',await approverFeed({rol:'GERENTE'},cursor)).events.some(e=>e.category==='manejo'),false);
 assert.equal((await listPendingManejoComentadoAuthorizations()).some(e=>e.id_viajes===trip),false);
 const cancelled=await createTrip();const pending=await requestManejoComentadoAuthorization({idViaje:cancelled,idConductor:driver});
 const beforeCancel=await approverFeed({rol:'GERENTE'},first.cursor);
 await db.query("UPDATE viajes SET id_estado_viaje=(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='CANCELADO') WHERE id_viajes=$1",[cancelled]);
 const cleanup=pushSnapshot('test',await approverFeed({rol:'GERENTE'},beforeCancel.cursor));assert.equal(cleanup.events.length,0);assert.ok(cleanup.resolvedManejoTrips.includes(String(cancelled)));
 await assert.rejects(decideManejoComentadoAuthorization({idAutorizacion:pending.id_autorizacion,idUsuarioAdmin:admin,approved:true,firma:'test'}),{statusCode:409});
 assert.equal((await listPendingManejoComentadoAuthorizations()).some(e=>e.id_viajes===cancelled),false);
 assert.equal((await db.query('SELECT estado FROM autorizaciones_manejo_comentado_viaje WHERE id_autorizacion=$1',[pending.id_autorizacion])).rows[0].estado,'PENDIENTE');
 const rejected=await createTrip();const rejection=await requestManejoComentadoAuthorization({idViaje:rejected,idConductor:driver});const last=(await approverFeed({rol:'ADMINISTRADOR'})).cursor;
 await decideManejoComentadoAuthorization({idAutorizacion:rejection.id_autorizacion,idUsuarioAdmin:admin,approved:false,firma:'test'});
 const silent=pushSnapshot('test',await approverFeed({rol:'ADMINISTRADOR'},last));assert.equal(silent.events.length,0);assert.ok(silent.resolvedManejoTrips.includes(String(rejected)));
});

test('decidir manejo no retira otras aprobaciones pendientes del viaje',()=>{
 const packet=pushSnapshot('test',{events:[{id:'1',tripId:'1',categoria:'manejo',estado:'APROBADA',resolved:false}],critical:[{tripId:'1',folio:'VJ',fueraEstado:true}],polledAt:new Date().toISOString()});
 assert.deepEqual(packet.resolvedManejoTrips,['1']);assert.deepEqual(packet.resolvedTrips,[]);assert.equal(packet.critical.count,1);assert.equal(packet.events.length,0);
});
