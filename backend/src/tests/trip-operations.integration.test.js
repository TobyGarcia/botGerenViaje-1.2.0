import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { databasePool } from '../database/pool.js';
import { listTripItems, recordTripOperation, recordCompanionBatch, closeTripItems } from '../services/trip-operations.service.js';
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
  await db.query('BEGIN'); await closeTripItems({ query }, 1); await db.query('COMMIT');
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
