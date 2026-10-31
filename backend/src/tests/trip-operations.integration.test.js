import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { databasePool } from '../database/pool.js';
import { listTripItems, recordTripOperation, closeTripItems } from '../services/trip-operations.service.js';

const db = new PGlite();
await db.exec(`CREATE TABLE estados_viaje(id_estado_viaje INT PRIMARY KEY,nombre TEXT);
 CREATE TABLE vehiculos(id_vehiculos INT PRIMARY KEY,nombre TEXT,tipo_vehiculo TEXT,marca TEXT,modelo TEXT);
 CREATE TABLE viajes(id_viajes INT PRIMARY KEY,id_conductores INT,id_estado_viaje INT,folio TEXT,acompanantes JSONB,hora_salida TIMESTAMPTZ,creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE inspecciones_vehiculares(id_inspeccion INT PRIMARY KEY,id_viajes INT,id_conductores INT,id_remolque INT,lleva_remolque BOOLEAN,inspeccion_remolque JSONB,estado TEXT,fecha_operativa DATE);
 CREATE TABLE ubicaciones_viaje(id_ubicaciones_viaje INT,id_viajes INT,latitud FLOAT,longitud FLOAT,fecha_gps TIMESTAMPTZ);
 INSERT INTO estados_viaje VALUES(1,'EN_CURSO');
 INSERT INTO vehiculos VALUES(1,'L200','Camioneta',NULL,NULL),(2,'R-1','Remolque',NULL,NULL);
 INSERT INTO viajes(id_viajes,id_conductores,id_estado_viaje,folio,acompanantes) VALUES(1,10,1,'TEST-1','["Ana"]'),(2,20,1,'TEST-2','[]');`);
await db.exec(await readFile(new URL('../../../database/migrations/042_trip_operations.sql', import.meta.url), 'utf8'));
const query = async (sql, params) => { const r = await db.query(sql, params); return { ...r, rowCount: r.rows.length }; };
databasePool.query = query;
databasePool.connect = async () => ({ query, release() {} });
after(async () => { await db.close(); await databasePool.end(); });
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
    inspection: { idRemolque: 2, checklist: { luces: 'M' }, danos: {} } });
  const attached = await recordTripOperation(1,10,hook);
  const trailer = (await listTripItems(1,10)).find(i => i.kind === 'trailer');
  assert.equal(trailer.inspection.data.checklist.luces, 'M');
  assert.equal(trailer.inspection.estado, 'PENDIENTE_APROBACION');
  await recordTripOperation(1,10,operation('TRAILER_DETACHED', { itemId: Number(attached.item_id) }));
  await recordTripOperation(1,10,operation('TRAILER_ATTACHED', { itemId: 2, inspectionMode: 'existing', warningConfirmed: true }));
  await db.query('BEGIN'); await closeTripItems({ query }, 1); await db.query('COMMIT');
  assert.equal((await listTripItems(1,10)).filter(i => !i.removed_at).length, 0);
  const events = await query('SELECT * FROM trip_operation_events');
  assert.equal(events.rows.some(e => e.event_type.includes('INSPECTION')), false);
  assert.ok(events.rows.every(e => e.payload.folio === 'TEST-1'));
});
