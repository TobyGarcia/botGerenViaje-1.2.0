import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool as db } from '../database/pool.js';
import { listAdminTrips } from '../services/admin-viajes.service.js';
import { listPendingInspections, countPendingInspections } from '../services/inspecciones.service.js';
import { aprovarGerenciamiento } from '../services/gerenciamiento-viajes.service.js';
const signature='data:image/png;base64,dGVzdA==';
test('gerencia filtra horarios y aprobación posterior limita vehículo/día sin reiniciar viaje',async()=>{
const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Scope prueba') RETURNING id_conductores")).rows[0].id_conductores;
const vehicle=async()=>(await db.query('INSERT INTO vehiculos(nombre,numero_economico) VALUES($1,$1) RETURNING id_vehiculos',[randomUUID()])).rows[0].id_vehiculos;
const car=await vehicle(),other=await vehicle();
const place=(await db.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares;
const destination=(await db.query("INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares",[randomUUID()])).rows[0].id_lugares;
const trip=async(time,v=car)=>(await db.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,hora_salida,creado_en,licencia_vigente,motivo) VALUES($1,$2,$3,$4,$6,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='FINALIZADO'),100,$5,$5,TRUE,'Prueba') RETURNING id_viajes`,[randomUUID().slice(0,28),driver,v,place,'2026-11-10 '+time,destination])).rows[0].id_viajes;
const day=await trip('06:00'),lastDay=await trip('17:59'),early=await trip('05:59'),late=await trip('18:00'),outside=await trip('10:00'),different=await trip('11:00',other),nextDay=await trip('12:00');
const inspection=async(id,v=car,date='2026-11-10')=>(await db.query(`INSERT INTO inspecciones_vehiculares(id_viajes,id_vehiculos,id_conductores,fecha_operativa,combustible,firma_conductor,estado,tipo_asignacion) VALUES($1,$2,$3,$4,'F',$5,'PENDIENTE_APROBACION','PERMANENTE') RETURNING id_inspeccion`,[id,v,driver,date,signature])).rows[0].id_inspeccion;
const dayI=await inspection(day),outsideI=await inspection(outside),otherI=await inspection(different,other),nextI=await inspection(nextDay,car,'2026-11-11'),sharedI=await inspection(lastDay);
await db.query('INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion) VALUES($1,$2)',[late,sharedI]);
const geren=(await db.query("INSERT INTO gerenciamiento_viajes(id_viaje,id_conductor,nivel_riesgo,estado) VALUES($1,$2,'ALTO','PENDIENTE') RETURNING id_gerenciamiento",[outside,driver])).rows[0].id_gerenciamiento;
for(const role of ['GERENTE','GERENTE_GENERAL']){
assert.deepEqual((await listAdminTrips({idConductor:driver,adminRole:role})).map(r=>r.id_viajes).sort(),[early,late,outside].sort());
assert.deepEqual((await listPendingInspections(role)).map(r=>r.id_inspeccion).sort(),[outsideI,sharedI].sort());
assert.equal(await countPendingInspections(role),2);
}
for(const role of ['SUPERVISOR','COORDINADOR','QHSE','ADMINISTRADOR']) assert.equal((await listAdminTrips({idConductor:driver,adminRole:role})).length,7);
const actor=(await db.query("INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,'GERENTE') RETURNING id_usuarios_admin",[driver])).rows[0].id_usuarios_admin;
const decision={idGerenciamiento:geren,idUsuarioAdmin:actor,nombreAutorizador:'Prueba',firmaAutorizador:signature};
await aprovarGerenciamiento(decision);
assert.equal((await db.query('SELECT ev.nombre FROM viajes v JOIN estados_viaje ev USING(id_estado_viaje) WHERE id_viajes=$1',[outside])).rows[0].nombre,'FINALIZADO');
const states=(await db.query('SELECT id_inspeccion,estado FROM inspecciones_vehiculares')).rows;
assert.equal(states.find(i=>i.id_inspeccion===dayI).estado,'APROBADA');
assert.equal(states.find(i=>i.id_inspeccion===otherI).estado,'PENDIENTE_APROBACION');
assert.equal(states.find(i=>i.id_inspeccion===nextI).estado,'PENDIENTE_APROBACION');
await assert.rejects(aprovarGerenciamiento(decision),/ya tiene una decisión/);
});



test('las decisiones requieren sesión y no permiten suplantar al autorizador',async()=>{
 const {default:express}=await import('express');
 const {default:router}=await import('../routes/gerenciamiento-viajes.routes.js');
 const {createAdminSessionToken}=await import('../utils/admin-session.js');
 const app=express(); app.use(express.json()); app.use('/geren',router);
 const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
 try {
  const url=`http://127.0.0.1:${server.address().port}/geren`;
  for(const path of ['aprobar','decision']) assert.equal((await fetch(`${url}/1/${path}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Actor real') RETURNING id_conductores")).rows[0].id_conductores;
  const actor=(await db.query("INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,'SUPERVISOR') RETURNING id_usuarios_admin",[driver])).rows[0].id_usuarios_admin;
  const id=(await db.query("INSERT INTO gerenciamiento_viajes(estado,nivel_riesgo) VALUES('PENDIENTE','BAJO') RETURNING id_gerenciamiento")).rows[0].id_gerenciamiento;
  const token=createAdminSessionToken({id_usuarios_admin:actor,rol:'SUPERVISOR'});
  const response=await fetch(`${url}/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({estado:'RECHAZADO',idUsuarioAdmin:999999,nombreAutorizador:'Suplantado'})});
  assert.equal(response.status,200,await response.text());
  const record=(await db.query('SELECT id_usuario_autorizador,nombre_autorizador_firma FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1',[id])).rows[0];
  assert.equal(record.id_usuario_autorizador,actor); assert.equal(record.nombre_autorizador_firma,'Actor real');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
