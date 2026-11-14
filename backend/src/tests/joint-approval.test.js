import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {databasePool as db}from'../database/pool.js';import {approveInspection}from'../services/inspecciones.service.js';import {aprovarGerenciamiento}from'../services/gerenciamiento-viajes.service.js';
const signature='data:image/png;base64,dGVzdA==';
async function fixture(risk='ALTO'){
 const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Conductor conjunto') RETURNING id_conductores")).rows[0].id_conductores;
 const vehicle=(await db.query('INSERT INTO vehiculos(nombre,numero_economico) VALUES($1,$1) RETURNING id_vehiculos',[randomUUID()])).rows[0].id_vehiculos;
 const place=async()=>(await db.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares;const origin=await place(),dest=await place();
 const trip=(await db.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo) VALUES($1,$2,$3,$4,$5,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='PENDIENTE'),100,TRUE,'Prueba conjunta') RETURNING id_viajes`,[randomUUID().slice(0,28),driver,vehicle,origin,dest])).rows[0].id_viajes;
 const inspection=(await db.query(`INSERT INTO inspecciones_vehiculares(id_viajes,id_conductores,id_vehiculos,fecha_operativa,combustible,tipo_asignacion,firma_conductor,estado) VALUES($1,$2,$3,CURRENT_DATE,'F','PERMANENTE',$4,'PENDIENTE_APROBACION') RETURNING id_inspeccion`,[trip,driver,vehicle,signature])).rows[0].id_inspeccion;
 const management=(await db.query("INSERT INTO gerenciamiento_viajes(id_viaje,id_conductor,nivel_riesgo,estado) VALUES($1,$2,$3,'PENDIENTE') RETURNING id_gerenciamiento",[trip,driver,risk])).rows[0].id_gerenciamiento;
 return {driver,vehicle,trip,inspection,management};
}
async function actor(role){const driver=(await db.query("INSERT INTO conductores(nombre) VALUES('Aprobador conjunto') RETURNING id_conductores")).rows[0].id_conductores;return(await db.query('INSERT INTO usuarios_admin(id_conductores,rol) VALUES($1,$2) RETURNING id_usuarios_admin',[driver,role])).rows[0].id_usuarios_admin;}
const decide=(f,id)=>approveInspection({idInspeccion:f.inspection,idUsuarioAdmin:id,approved:true,firmaSupervisor:signature,comentario:'Conjunta'});
async function states(f){return(await db.query('SELECT g.estado AS management,i.estado AS inspection FROM gerenciamiento_viajes g CROSS JOIN inspecciones_vehiculares i WHERE g.id_gerenciamiento=$1 AND i.id_inspeccion=$2',[f.management,f.inspection])).rows[0];}
test('desde inspección se aprueban ambos según permisos por riesgo y sin cambios parciales',async()=>{
 for(const [risk,role,allowed] of [['BAJO','SUPERVISOR',true],['BAJO','QHSE',true],['MEDIO','SUPERVISOR',false],['MEDIO','COORDINADOR',true],['ALTO','COORDINADOR',false],['ALTO','GERENTE',true],['ALTO','ADMINISTRADOR',true]]){
 const f=await fixture(risk),id=await actor(role);if(allowed){const result=await decide(f,id);assert.equal(result.jointApproval.idGerenciamiento,f.management);assert.deepEqual(await states(f),{management:'APROBADO',inspection:'APROBADA'});}else{await assert.rejects(decide(f,id),e=>e.statusCode===403);assert.deepEqual(await states(f),{management:'PENDIENTE',inspection:'PENDIENTE_APROBACION'});}
 }
});
test('completa gerenciamiento con inspección previamente aprobada y conserva su firma',async()=>{
 const f=await fixture(),id=await actor('GERENTE');await db.query("UPDATE inspecciones_vehiculares SET estado='APROBADA',firma_supervisor='firma anterior' WHERE id_inspeccion=$1",[f.inspection]);await decide(f,id);assert.deepEqual(await states(f),{management:'APROBADO',inspection:'APROBADA'});assert.equal((await db.query('SELECT firma_supervisor FROM inspecciones_vehiculares WHERE id_inspeccion=$1',[f.inspection])).rows[0].firma_supervisor,'firma anterior');
});
test('la decisión desde gerenciamiento también es conjunta y un doble clic no duplica la aprobación',async()=>{
 const f=await fixture(),id=await actor('GERENTE');const results=await Promise.allSettled([1,2].map(()=>aprovarGerenciamiento({idGerenciamiento:f.management,idUsuarioAdmin:id,firmaAutorizador:signature})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(await states(f),{management:'APROBADO',inspection:'APROBADA'});
});
test('un fallo al actualizar la inspección revierte también la aprobación del gerenciamiento',async()=>{
 const f=await fixture(),id=await actor('GERENTE');await db.query(`CREATE OR REPLACE FUNCTION joint_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id_inspeccion=${Number(f.inspection)} THEN RAISE EXCEPTION 'simulated inspection failure'; END IF;RETURN NEW;END $$;`);await db.query('CREATE TRIGGER joint_test_failure BEFORE UPDATE ON inspecciones_vehiculares FOR EACH ROW EXECUTE FUNCTION joint_test_failure()');
 try{await assert.rejects(decide(f,id),/simulated inspection failure/);assert.deepEqual(await states(f),{management:'PENDIENTE',inspection:'PENDIENTE_APROBACION'});}finally{await db.query('DROP TRIGGER joint_test_failure ON inspecciones_vehiculares');await db.query('DROP FUNCTION joint_test_failure()');}
});

test('sin inspección no deja aprobado el gerenciamiento',async()=>{
 const f=await fixture(),id=await actor('GERENTE');await db.query('DELETE FROM inspecciones_vehiculares WHERE id_inspeccion=$1',[f.inspection]);
 await assert.rejects(aprovarGerenciamiento({idGerenciamiento:f.management,idUsuarioAdmin:id,firmaAutorizador:signature}),e=>e.statusCode===409);
 assert.equal((await db.query('SELECT estado FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1',[f.management])).rows[0].estado,'PENDIENTE');
});
test('una inspección diaria reutilizada encuentra el nuevo gerenciamiento del mismo vehículo y exige su riesgo',async()=>{
 const f=await fixture(),id=await actor('SUPERVISOR');
 await db.query("UPDATE inspecciones_vehiculares SET creado_en=CURRENT_TIMESTAMP-INTERVAL '5 minutes',fecha_operativa=(CURRENT_TIMESTAMP+INTERVAL '2 hours')::date WHERE id_inspeccion=$1",[f.inspection]);
 await db.query("UPDATE viajes SET creado_en=CURRENT_TIMESTAMP-INTERVAL '10 minutes' WHERE id_viajes=$1",[f.trip]);
 const next=(await db.query("INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo) SELECT $1,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,101,TRUE,'Reutilizado' FROM viajes WHERE id_viajes=$2 RETURNING id_viajes",[randomUUID().slice(0,28),f.trip])).rows[0].id_viajes;
 await db.query('UPDATE gerenciamiento_viajes SET id_viaje=$1 WHERE id_gerenciamiento=$2',[next,f.management]);
 await assert.rejects(decide(f,id),e=>e.statusCode===403);assert.deepEqual(await states(f),{management:'PENDIENTE',inspection:'PENDIENTE_APROBACION'});
 await decide(f,await actor('GERENTE'));assert.deepEqual(await states(f),{management:'APROBADO',inspection:'APROBADA'});
 assert.equal(String((await db.query('SELECT id_inspeccion FROM viaje_inspeccion_uso WHERE id_viajes=$1',[next])).rows[0].id_inspeccion),String(f.inspection));
});

async function cancelFixture(f){const {cancelTrip}=await import('../services/viajes.service.js');return cancelTrip({idViaje:f.trip});}
async function linkedTrip(f,{usage=true,management=true,finalized=false}={}){
 const trip=(await db.query("INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo,creado_en) SELECT $1,id_conductores,id_vehiculos,id_origen,id_destino,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre=$3),101,TRUE,'Uso compartido',CURRENT_TIMESTAMP+INTERVAL '1 minute' FROM viajes WHERE id_viajes=$2 RETURNING id_viajes",[randomUUID().slice(0,28),f.trip,finalized?'FINALIZADO':'PENDIENTE'])).rows[0].id_viajes;
 if(usage)await db.query('INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion) VALUES($1,$2)',[trip,f.inspection]);
 const g=management?(await db.query("INSERT INTO gerenciamiento_viajes(id_viaje,id_conductor,nivel_riesgo,estado) VALUES($1,$2,'MEDIO','PENDIENTE') RETURNING id_gerenciamiento",[trip,f.driver])).rows[0].id_gerenciamiento:null;
 return {trip,management:g};
}
test('cancelar retira la solicitud, bloquea pantallas antiguas y conserva datos, PDF y anexos',async()=>{
 const {getAdminInspection,countPendingInspections,listPendingInspections}=await import('../services/inspecciones.service.js');
 const {getGerenciamientoById,listGerenciamientos}=await import('../services/gerenciamiento-viajes.service.js');
 const {approverFeed}=await import('../services/approver-notifications.service.js');const {pushSnapshot}=await import('../services/approver-push.service.js');
 const f=await fixture(),id=await actor('GERENTE');await db.query("UPDATE inspecciones_vehiculares SET pdf_nombre='historial.pdf',pdf_documento=$2,inspeccion_remolque=$3 WHERE id_inspeccion=$1",[f.inspection,Buffer.from('historical pdf'),JSON.stringify({evidencia:'conservar'})]);
 const before=(await db.query('SELECT to_jsonb(i) AS value FROM inspecciones_vehiculares i WHERE id_inspeccion=$1',[f.inspection])).rows[0].value;
 const count=await countPendingInspections();const cursor=(await db.query('SELECT MAX(id_evento)::text AS id FROM aprobador_eventos')).rows[0].id;
 await cancelFixture(f);
 assert.deepEqual((await db.query('SELECT to_jsonb(i) AS value FROM inspecciones_vehiculares i WHERE id_inspeccion=$1',[f.inspection])).rows[0].value,before);
 assert.equal((await getAdminInspection(f.inspection)).approval_available,false);assert.equal((await listPendingInspections()).find(i=>String(i.id_inspeccion)===String(f.inspection)).approval_available,false);assert.equal(await countPendingInspections(),count-1);
 assert.equal((await getGerenciamientoById(f.management)).approval_available,false);assert.equal((await listGerenciamientos({estado:'PENDIENTE'})).some(g=>g.id_gerenciamiento===f.management),false);
 await assert.rejects(decide(f,id),e=>e.statusCode===409);await assert.rejects(aprovarGerenciamiento({idGerenciamiento:f.management,idUsuarioAdmin:id,firmaAutorizador:signature}),e=>e.statusCode===409);
 assert.deepEqual(await states(f),{management:'PENDIENTE',inspection:'PENDIENTE_APROBACION'});
 const payload=pushSnapshot('test',await approverFeed({rol:'GERENTE'},cursor));assert.equal(payload.events.length,0);assert.ok(payload.resolvedTrips.includes(String(f.trip)));assert.equal(payload.critical.folios.includes((await db.query('SELECT folio FROM viajes WHERE id_viajes=$1',[f.trip])).rows[0].folio),false);
});
test('cancelar el origen conserva la inspección usada por otro viaje finalizado y aprueba solo ese gerenciamiento',async()=>{
 const {getAdminInspection}=await import('../services/inspecciones.service.js');const f=await fixture(),id=await actor('GERENTE');const other=await linkedTrip(f,{finalized:true});await cancelFixture(f);
 const detail=await getAdminInspection(f.inspection);assert.equal(detail.approval_available,true);assert.equal(detail.approval_trip_id,other.trip);assert.equal(detail.approval_context.management.id_gerenciamiento,other.management);
 await decide(f,id);assert.equal((await states(f)).management,'PENDIENTE');assert.equal((await states(f)).inspection,'APROBADA');assert.equal((await db.query('SELECT estado FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1',[other.management])).rows[0].estado,'APROBADO');
});
test('la reutilización diaria aún sin vínculo explícito mantiene el pendiente del nuevo viaje',async()=>{
 const {getAdminInspection}=await import('../services/inspecciones.service.js');const f=await fixture(),id=await actor('GERENTE');await db.query("UPDATE inspecciones_vehiculares SET creado_en=CURRENT_TIMESTAMP-INTERVAL '1 minute',fecha_operativa=(CURRENT_TIMESTAMP+INTERVAL '2 hours')::date WHERE id_inspeccion=$1",[f.inspection]);const other=await linkedTrip(f,{usage:false});await cancelFixture(f);
 assert.equal((await getAdminInspection(f.inspection)).approval_available,true);await decide(f,id);assert.equal((await states(f)).management,'PENDIENTE');assert.equal((await db.query('SELECT estado FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1',[other.management])).rows[0].estado,'APROBADO');
});
test('si también se cancela el último viaje consumidor, la inspección queda retirada sin cambiar su estado',async()=>{
 const {getAdminInspection}=await import('../services/inspecciones.service.js');const f=await fixture(),id=await actor('GERENTE');const other=await linkedTrip(f,{management:false});await cancelFixture(f);await cancelFixture({trip:other.trip});assert.equal((await getAdminInspection(f.inspection)).approval_available,false);await assert.rejects(decide(f,id),e=>e.statusCode===409);assert.equal((await states(f)).inspection,'PENDIENTE_APROBACION');
});
test('una aprobación anterior a la cancelación conserva firma y estado aprobado',async()=>{
 const f=await fixture(),id=await actor('GERENTE');await decide(f,id);await cancelFixture(f);assert.deepEqual(await states(f),{management:'APROBADO',inspection:'APROBADA'});assert.equal((await db.query('SELECT firma_supervisor FROM inspecciones_vehiculares WHERE id_inspeccion=$1',[f.inspection])).rows[0].firma_supervisor,signature);
});

test('la reconciliación de viajes ya cancelados es idempotente y solo retira avisos',async()=>{
 const {readFile}=await import('node:fs/promises');const {approverFeed}=await import('../services/approver-notifications.service.js');const {pushSnapshot}=await import('../services/approver-push.service.js');
 const f=await fixture();await cancelFixture(f);const cursor=(await db.query('SELECT MAX(id_evento)::text AS id FROM aprobador_eventos')).rows[0].id;
 const sql=(await readFile(new URL('../../../database/migrations/047_cancelled_approval_withdrawals.sql',import.meta.url),'utf8')).replace(/\bBEGIN;|\bCOMMIT;/g,'');
 await db.query(sql);await db.query(sql);
 assert.equal(Number((await db.query("SELECT COUNT(*) AS count FROM aprobador_eventos WHERE id_viajes=$1 AND categoria='withdrawal'",[f.trip])).rows[0].count),1);
 const p=pushSnapshot('test',await approverFeed({rol:'GERENTE'},cursor));assert.equal(p.events.length,0);assert.ok(p.resolvedTrips.includes(String(f.trip)));assert.deepEqual(await states(f),{management:'PENDIENTE',inspection:'PENDIENTE_APROBACION'});
});

test('otro viaje con inspección propia no mantiene pendiente la inspección del viaje cancelado',async()=>{
 const {getAdminInspection}=await import('../services/inspecciones.service.js');const f=await fixture(),id=await actor('GERENTE');
 await db.query("UPDATE inspecciones_vehiculares SET creado_en=CURRENT_TIMESTAMP-INTERVAL '2 minutes',fecha_operativa=(CURRENT_TIMESTAMP+INTERVAL '2 hours')::date WHERE id_inspeccion=$1",[f.inspection]);
 const other=await linkedTrip(f,{usage:false,management:false});
 await db.query("INSERT INTO inspecciones_vehiculares(id_viajes,id_conductores,id_vehiculos,fecha_operativa,combustible,tipo_asignacion,firma_conductor,estado) VALUES($1,$2,$3,(CURRENT_TIMESTAMP+INTERVAL '2 hours')::date,'F','PERMANENTE',$4,'PENDIENTE_APROBACION')",[other.trip,f.driver,f.vehicle,signature]);
 await cancelFixture(f);assert.equal((await getAdminInspection(f.inspection)).approval_available,false);await assert.rejects(decide(f,id),e=>e.statusCode===409);assert.equal((await states(f)).inspection,'PENDIENTE_APROBACION');
});

test('grupos de APK separan locales y gerenciamientos sin perder inspecciones compartidas',async()=>{
 const {listPendingInspections}=await import('../services/inspecciones.service.js');
 const {listGerenciamientos}=await import('../services/gerenciamiento-viajes.service.js');
 const managed=await fixture('BAJO');
 assert.equal((await listPendingInspections()).find(i=>i.id_inspeccion===managed.inspection).approval_group,'management');
 await db.query("UPDATE gerenciamiento_viajes SET estado='APROBADO' WHERE id_gerenciamiento=$1",[managed.management]);
 assert.equal((await listGerenciamientos({estado:'PENDIENTE'})).some(g=>g.id_gerenciamiento===managed.management),false);
 const pending=(await listGerenciamientos({estado:'PENDIENTE',includePendingInspection:true})).find(g=>g.id_gerenciamiento===managed.management);
 assert.equal(pending.inspeccion_estado,'PENDIENTE_APROBACION');
 assert.equal(pending.vehiculo_nombre,(await db.query('SELECT nombre FROM vehiculos WHERE id_vehiculos=$1',[managed.vehicle])).rows[0].nombre);
 const {listGerenciamientosController}=await import('../controllers/gerenciamiento-viajes.controller.js');let payload;
 await listGerenciamientosController({query:{estado:'PENDIENTE',includeInspection:'true'}},{json:value=>{payload=value;},status:()=>{throw Error('Unexpected list error');}});
 assert.ok(payload.data.some(g=>g.id_gerenciamiento===managed.management));

 const local=await fixture('BAJO');await db.query('DELETE FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1',[local.management]);
 assert.equal((await listPendingInspections()).find(i=>i.id_inspeccion===local.inspection).approval_group,'local');
 const consumer=(await db.query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,licencia_vigente,motivo)
 SELECT $1,id_conductores,id_vehiculos,id_origen,id_destino,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='PENDIENTE'),100,TRUE,'Local compartido' FROM viajes WHERE id_viajes=$2 RETURNING id_viajes`,[randomUUID().slice(0,28),managed.trip])).rows[0].id_viajes;
 await db.query('INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion) VALUES($1,$2)',[consumer,managed.inspection]);
 await db.query("UPDATE viajes SET id_estado_viaje=(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='CANCELADO') WHERE id_viajes=$1",[managed.trip]);
 const shared=(await listPendingInspections()).find(i=>i.id_inspeccion===managed.inspection);assert.equal(shared.approval_group,'local');assert.equal(shared.approval_available,true);
 assert.equal((await listGerenciamientos({estado:'PENDIENTE',includePendingInspection:true})).some(g=>g.id_gerenciamiento===managed.management),false);
 await db.query("UPDATE viajes SET id_estado_viaje=(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='CANCELADO') WHERE id_viajes=$1",[consumer]);
 assert.equal((await listPendingInspections()).find(i=>i.id_inspeccion===managed.inspection).approval_group,'management');
});
