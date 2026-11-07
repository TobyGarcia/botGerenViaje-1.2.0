import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { databasePool } from '../database/pool.js';
import { listTripItems, recordTripOperation, recordCompanionBatch, recordConfirmedActions, closeTripItems } from '../services/trip-operations.service.js';
import { createTrip } from '../services/viajes.service.js';

// Esta prueba usa un esquema mínimo propio, sin las tablas de auditoría.
process.env.AUDIT_PERSISTENCE = 'false';
process.env.AUDIT_STDOUT = 'false';

const db = new PGlite();
await db.exec(`CREATE TABLE estados_viaje(id_estado_viaje INT PRIMARY KEY,nombre TEXT);
 CREATE TABLE vehiculos(id_vehiculos INT PRIMARY KEY,nombre TEXT,tipo_vehiculo TEXT,marca TEXT,modelo TEXT);
 CREATE TABLE viajes(id_viajes INT PRIMARY KEY,id_conductores INT,id_estado_viaje INT,folio TEXT,acompanantes JSONB,hora_salida TIMESTAMPTZ,creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE inspecciones_vehiculares(id_inspeccion INT PRIMARY KEY,id_viajes INT,id_conductores INT,id_remolque INT,lleva_remolque BOOLEAN,inspeccion_remolque JSONB,estado TEXT,fecha_operativa DATE);
 CREATE TABLE ubicaciones_viaje(id_ubicaciones_viaje SERIAL PRIMARY KEY,id_viajes INT,latitud FLOAT,longitud FLOAT,fecha_gps TIMESTAMPTZ,
 precision_metros FLOAT,velocidad FLOAT,direccion FLOAT,es_punto_intermedio BOOLEAN,nombre_punto TEXT,creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO estados_viaje VALUES(1,'EN_CURSO');
 INSERT INTO vehiculos VALUES(1,'L200','Camioneta',NULL,NULL),(2,'R-1','Remolque',NULL,NULL);
 INSERT INTO viajes(id_viajes,id_conductores,id_estado_viaje,folio,acompanantes) VALUES(1,10,1,'TEST-1','["Ana"]'),(2,20,1,'TEST-2','[]');`);
await db.exec(await readFile(new URL('../../../database/migrations/042_trip_operations.sql', import.meta.url), 'utf8'));
await db.exec(`CREATE TABLE lugares(id_lugares INT PRIMARY KEY, nombre TEXT, activo BOOLEAN);
 INSERT INTO lugares VALUES(1,'ASPX - LA PAZ',TRUE),(2,'Destino inactivo',FALSE);
 ALTER TABLE ubicaciones_viaje ALTER COLUMN nombre_punto TYPE VARCHAR(150);`);
const stopMigration = await readFile(new URL('../../../database/migrations/043_trip_stop_description.sql', import.meta.url), 'utf8');
await db.exec(stopMigration);
await db.exec(stopMigration);
const query = async (sql, params) => { const r = await db.query(sql, params); return { ...r, rowCount: r.rows.length }; };
databasePool.query = query;
databasePool.connect = async () => ({ query, release() {} });
after(async () => { await db.close(); if (!databasePool.ending) await databasePool.end(); });
const operation = (type, extra) => ({ type, latitude: 19.4, longitude: -99.1, eventKey: crypto.randomUUID(), ...extra });

test('flujo completo: inicial baja, nuevo sube, inspección y cambio de remolque', async () => {
  const initial = await listTripItems(1, 10);
  assert.equal(initial[0].name, 'Ana');
  const leave = operation('COMPANION_DROPPED_OFF', { itemId: Number(initial[0].id) });
  const saved = await recordTripOperation(1,10,leave);
  assert.equal((await recordTripOperation(1,10,leave)).id, saved.id);
  assert.ok((await listTripItems(1,10))[0].removed_at);
  await assert.rejects(recordTripOperation(1,10,operation('COMPANION_DROPPED_OFF', { itemId: Number(initial[0].id) })));
  await recordTripOperation(1,10,operation('COMPANION_ADDED', { name: 'Luis' }));
  await assert.rejects(listTripItems(1,20), /conductor/);
  await assert.rejects(recordTripOperation(1,10,operation('TRAILER_ATTACHED', { itemId: 1, inspectionMode: 'none', warningConfirmed: true })), /remolque válido/);
  const hook = operation('TRAILER_ATTACHED', { itemId: 2, inspectionMode: 'new', warningConfirmed: true,
    inspection: { captureId: crypto.randomUUID(), idRemolque: 2, checklist: { luces: 'M' }, danos: {} } });
  const attached = await recordTripOperation(1,10,hook);
  const trailer = (await listTripItems(1,10)).find(i => i.kind === 'trailer');
  assert.equal(trailer.inspection.data.checklist.luces, 'M');
  assert.equal(trailer.inspection.estado, 'PENDIENTE_APROBACION');
  await recordTripOperation(1,10,operation('TRAILER_DETACHED', { itemId: Number(attached.item_id) }));
  for (const inspectionMode of ['existing', 'none', undefined]) {
    await assert.rejects(recordTripOperation(1,10,operation('TRAILER_ATTACHED', { itemId: 2, inspectionMode, warningConfirmed: true })), /inspección nueva/);
  }
  await assert.rejects(recordTripOperation(1,10,{ ...hook, eventKey: crypto.randomUUID() }), /ya se utilizó/);
  await recordTripOperation(1,10,{ ...hook, eventKey: crypto.randomUUID(), inspection: { ...hook.inspection, captureId: crypto.randomUUID() } });
  const stops = await query('SELECT * FROM ubicaciones_viaje ORDER BY id_ubicaciones_viaje');
  assert.equal(stops.rows.length, 5, 'un punto por movimiento, sin duplicar reintentos');
  assert.ok(stops.rows.every(p => p.es_punto_intermedio && p.latitud === 19.4 && p.longitud === -99.1));
  assert.match(stops.rows[0].nombre_punto, /Se dejó acompañante Ana/);
  assert.match(stops.rows[1].nombre_punto, /Se subió acompañante Luis/);
  assert.match(stops.rows[2].nombre_punto, /Se enganchó remolque R-1/);
  assert.match(stops.rows[3].nombre_punto, /Se dejó remolque R-1/);
  await db.exec("ALTER TABLE ubicaciones_viaje ADD CONSTRAINT test_stop_failure CHECK (nombre_punto NOT LIKE '%RECHAZAR%')");
  await assert.rejects(recordTripOperation(1,10,operation('COMPANION_ADDED', { name: 'RECHAZAR' })));
  assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE name='RECHAZAR'")).rows[0].n, 0, 'el movimiento se revierte si falla su parada');
  const eventsBeforeClose = (await query('SELECT count(*)::int AS n FROM trip_operation_events')).rows[0].n;
  await db.query('BEGIN'); const arrived = await closeTripItems({ query }, 1); await db.query('COMMIT');
  assert.ok(arrived.some(item => item.kind === 'companion'));
  assert.ok(arrived.some(item => item.kind === 'trailer'));
  assert.equal((await query('SELECT count(*)::int AS n FROM trip_operation_events')).rows[0].n, eventsBeforeClose, 'el cierre no genera avisos individuales adicionales');
  assert.equal((await listTripItems(1,10)).filter(i => !i.removed_at).length, 0);
  const events = await query('SELECT * FROM trip_operation_events');
  assert.equal(events.rows.some(e => e.event_type.includes('INSPECTION')), false);
  assert.ok(events.rows.every(e => e.payload.folio === 'TEST-1'));
});

test('agrega más de tres acompañantes juntos sin duplicar y revierte todo si falla una parada', async () => {
 const body = { names: ['Grupo Ana','Grupo Luis','Grupo Pedro','Grupo María'], latitude:19.4,longitude:-99.1,eventKey:crypto.randomUUID() };
 const beforeEvents=(await query('SELECT count(*)::int AS n FROM trip_operation_events')).rows[0].n;
 const beforeStops=(await query('SELECT count(*)::int AS n FROM ubicaciones_viaje')).rows[0].n;
 const event = await recordCompanionBatch(1,10,body);
 assert.deepEqual(event.payload.names,body.names);
 assert.equal(event.payload.companionIds.length,4);
 assert.equal((await recordCompanionBatch(1,10,body)).id,event.id);
 assert.equal((await query('SELECT count(*)::int AS n FROM trip_operation_events')).rows[0].n,beforeEvents+1);
 assert.equal((await query('SELECT count(*)::int AS n FROM ubicaciones_viaje')).rows[0].n,beforeStops+1);
 assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE name LIKE 'Grupo %'")).rows[0].n,4);
 await assert.rejects(recordTripOperation(1,10,operation('COMPANION_ADDED',{name:'Quinto'})), /máximo 4/);
 await assert.rejects(recordCompanionBatch(1,10,{...body,eventKey:crypto.randomUUID(),names:['Quinto','Sexto']}), /máximo 4/);
 for (const id of event.payload.companionIds.slice(0,2)) await recordTripOperation(1,10,operation('COMPANION_DROPPED_OFF',{itemId:Number(id)}));
 await assert.rejects(recordCompanionBatch(1,10,{...body,eventKey:crypto.randomUUID(),names:['Lote revertido','RECHAZAR']}));
 assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE name='Lote revertido'")).rows[0].n,0);
 await recordCompanionBatch(1,10,{...body,eventKey:crypto.randomUUID(),names:['Nuevo uno','Nuevo dos']});
 assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE kind='companion' AND removed_at IS NULL")).rows[0].n,4);
 const present = (await query("SELECT id FROM trip_operation_items WHERE kind='companion' AND removed_at IS NULL ORDER BY id")).rows;
 await recordTripOperation(1,10,operation('COMPANION_DROPPED_OFF',{itemId:Number(present[0].id)}));
 await assert.rejects(recordCompanionBatch(1,10,{...body,eventKey:crypto.randomUUID(),names:['Exceso uno','Exceso dos']}),/máximo 4/);
 assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE name LIKE 'Exceso %'")).rows[0].n,0);
 await assert.rejects(recordCompanionBatch(1,20,{...body,eventKey:crypto.randomUUID()}),/conductor/);
 await assert.rejects(recordCompanionBatch(1,10,{...body,names:[]}),/entre 1 y 4/);
});

test('no permite crear un viaje con cinco acompañantes iniciales', async () => {
 await assert.rejects(createTrip({acompanantes:Array.from({length:5},(_,i)=>({nombre:`Persona ${i}`}))}),/máximo 4/);
});

test('dos pasajeros juntos comparten un punto y evento, y pueden bajar por separado',async()=>{
 const body={names:['Dos Ana','Dos Luis'],latitude:19.4,longitude:-99.1,eventKey:crypto.randomUUID()};
 const event=await recordCompanionBatch(2,20,body);
 assert.equal((await query('SELECT count(*)::int AS n FROM trip_operation_events WHERE trip_id=2')).rows[0].n,1);
 const stops=(await query('SELECT * FROM ubicaciones_viaje WHERE id_viajes=2')).rows;
 assert.equal(stops.length,1); assert.match(stops[0].nombre_punto,/Dos Ana, Dos Luis/);
 await recordTripOperation(2,20,operation('COMPANION_DROPPED_OFF',{itemId:Number(event.payload.companionIds[0])}));
 const onboard=(await listTripItems(2,20)).filter(item=>!item.removed_at);
 assert.deepEqual(onboard.map(item=>item.name),['Dos Luis']);
});

test('confirma subidas, bajadas y remolques juntos: una parada, un evento y ninguna acción parcial',async()=>{
 const current=(await listTripItems(2,20)).find(i=>!i.removed_at && i.kind==='companion');
 const before=(await query('SELECT count(*)::int AS n FROM ubicaciones_viaje WHERE id_viajes=2')).rows[0].n;
 const beforeEvents=(await query('SELECT count(*)::int AS n FROM trip_operation_events WHERE trip_id=2')).rows[0].n;
 const body={placeId:1,latitude:19.4,longitude:-99.1,eventKey:crypto.randomUUID(),actions:[
  {type:'COMPANION_ADDED',name:'Confirmado Ana'},
  {type:'COMPANION_DROPPED_OFF',itemId:Number(current.id)},
  {type:'COMPANION_ADDED',name:'Confirmado Luis'},
  {type:'TRAILER_ATTACHED',itemId:2,inspectionMode:'new',warningConfirmed:true,inspection:{idRemolque:2,captureId:crypto.randomUUID(),checklist:{luces:'B'}}}
 ]};
 const saved=await recordConfirmedActions(2,20,body);
 assert.deepEqual(saved.payload.place,{id:1,name:'ASPX - LA PAZ'});
 const point=(await query('SELECT nombre_punto FROM ubicaciones_viaje WHERE id_viajes=2 ORDER BY id_ubicaciones_viaje DESC LIMIT 1')).rows[0];
 assert.match(point.nombre_punto,/^Parada técnica en ASPX - LA PAZ: Se dejó personal: Dos Luis; Se subió personal: Confirmado Ana, Confirmado Luis/);
 assert.equal(saved.payload.actions.length,4);
 assert.equal((await recordConfirmedActions(2,20,body)).id,saved.id);
 assert.equal((await query('SELECT count(*)::int AS n FROM ubicaciones_viaje WHERE id_viajes=2')).rows[0].n,before+1);
 assert.equal((await query('SELECT count(*)::int AS n FROM trip_operation_events WHERE trip_id=2')).rows[0].n,beforeEvents+1);
 const active=(await listTripItems(2,20)).filter(i=>!i.removed_at);
 const passenger=active.find(i=>i.name==='Confirmado Ana');
 await assert.rejects(recordConfirmedActions(2,20,{...body,eventKey:crypto.randomUUID(),actions:[{type:'COMPANION_DROPPED_OFF',itemId:Number(passenger.id)},{type:'TRAILER_ATTACHED',itemId:2}]}),/inspección nueva/);
 assert.ok((await listTripItems(2,20)).find(i=>i.id===passenger.id && !i.removed_at));
 assert.equal((await query('SELECT count(*)::int AS n FROM ubicaciones_viaje WHERE id_viajes=2')).rows[0].n,before+1);
});

test('rechaza destinos inválidos sin movimientos parciales y conserva nombres completos y el lugar histórico',async()=>{
 const base={latitude:19.4,longitude:-99.1,actions:[{type:'COMPANION_ADDED',name:'No guardar'}]};
 for (const placeId of [null,0,'1',2147483648,999,2]) {
  await assert.rejects(recordConfirmedActions(2,20,{...base,placeId,eventKey:crypto.randomUUID()}),/destino/);
 }
 assert.equal((await query("SELECT count(*)::int AS n FROM trip_operation_items WHERE name='No guardar'")).rows[0].n,0);
 const names=['A'.repeat(190),'B'.repeat(190)];
 const body={...base,placeId:1,eventKey:crypto.randomUUID(),actions:names.map(name=>({type:'COMPANION_ADDED',name}))};
 const saved=await recordConfirmedActions(2,20,body);
 const point=(await query('SELECT nombre_punto FROM ubicaciones_viaje WHERE id_viajes=2 ORDER BY id_ubicaciones_viaje DESC LIMIT 1')).rows[0];
 assert.ok(point.nombre_punto.includes(names.join(', ')));
 assert.ok(point.nombre_punto.length>150);
 await query("UPDATE lugares SET nombre='Nombre nuevo',activo=FALSE WHERE id_lugares=1");
 const retry=await recordConfirmedActions(2,20,body);
 assert.equal(retry.id,saved.id);
 assert.equal(retry.payload.place.name,'ASPX - LA PAZ');
});

test('reproduce paradas offline con referencias locales, horas originales e inspección nueva, sin duplicar',async()=>{
 await query("INSERT INTO viajes(id_viajes,id_conductores,id_estado_viaje,folio,acompanantes) VALUES(3,10,1,'OFFLINE-3','[\"Inicial\"]')");
 await query("INSERT INTO lugares VALUES(3,'Patio offline',TRUE)");
 const captured=new Date(Date.now()-120000).toISOString();
 const inspection={idRemolque:2,captureId:crypto.randomUUID(),checklist:{luces:'B'},danos:{frente:[{x:1,y:2}]}};
 const first={eventKey:crypto.randomUUID(),recordedAt:captured,latitude:19.4,longitude:-99.1,placeId:3,placeName:'Patio offline',actions:[
  {type:'COMPANION_DROPPED_OFF',itemRef:'companion-0'},
  {type:'TRAILER_ATTACHED',itemId:2,inspectionMode:'new',warningConfirmed:true,inspection},
  {type:'COMPANION_ADDED',name:'Persona local'}
 ]};
 const event=await recordConfirmedActions(3,10,first);
 assert.equal(+new Date(event.created_at),+new Date(captured));
 const added=(await query("SELECT * FROM trip_operation_items WHERE trip_id=3 AND kind='trailer'")).rows[0];
 assert.equal(added.initial_key,`movement-${first.eventKey}_1`);
 assert.deepEqual(added.inspection.data,inspection);
 assert.equal(+new Date(added.added_at),+new Date(captured));
 assert.equal(added.inspection.captured_at,captured);
 const initial=(await query("SELECT removed_at FROM trip_operation_items WHERE trip_id=3 AND initial_key='companion-0'")).rows[0];
 assert.equal(+new Date(initial.removed_at),+new Date(captured));
 const second={...first,eventKey:crypto.randomUUID(),recordedAt:new Date(Date.now()-60000).toISOString(),actions:[
  {type:'COMPANION_DROPPED_OFF',itemRef:`movement-${first.eventKey}_2`},
  {type:'TRAILER_DETACHED',itemRef:`movement-${first.eventKey}_1`}
 ]};
 await recordConfirmedActions(3,10,second);
 await assert.rejects(recordConfirmedActions(3,10,{...first,eventKey:crypto.randomUUID(),actions:[first.actions[1]]}),/ya se utilizó/);
 await assert.rejects(recordConfirmedActions(3,10,{...first,eventKey:crypto.randomUUID(),recordedAt:new Date(Date.now()+3600000).toISOString()}),/hora/);
 await query("UPDATE lugares SET activo=FALSE,nombre='Renombrado' WHERE id_lugares=3");
 await recordConfirmedActions(3,10,{...first,eventKey:crypto.randomUUID(),recordedAt:new Date(Date.now()-30000).toISOString(),actions:[{type:'TRAILER_ATTACHED',itemId:2,inspectionMode:'new',warningConfirmed:true,inspection:{...inspection,captureId:crypto.randomUUID()}}]});
 const stops=(await query('SELECT fecha_gps,nombre_punto FROM ubicaciones_viaje WHERE id_viajes=3 ORDER BY id_ubicaciones_viaje')).rows;
 assert.equal(stops.length,3);assert.equal(+new Date(stops[0].fecha_gps),+new Date(captured));
 assert.ok(stops.every(stop=>stop.nombre_punto.startsWith('Parada técnica en Patio offline:')));
 const finishTime=new Date(Date.now()-10000).toISOString();
 const closed=await closeTripItems({query},3,finishTime);
 assert.equal(closed.length,1);assert.equal(+new Date(closed[0].removed_at),+new Date(finishTime));
 await query("INSERT INTO estados_viaje VALUES(2,'FINALIZADO')");
 await query('UPDATE viajes SET id_estado_viaje=2 WHERE id_viajes=3');
 assert.equal((await recordConfirmedActions(3,10,first)).id,event.id);
 assert.equal((await query('SELECT count(*)::int AS n FROM trip_operation_events WHERE trip_id=3')).rows[0].n,3);
 assert.equal((await query('SELECT count(*)::int AS n FROM ubicaciones_viaje WHERE id_viajes=3')).rows[0].n,3);
 await assert.rejects(recordConfirmedActions(3,20,first),/conductor/);
});
