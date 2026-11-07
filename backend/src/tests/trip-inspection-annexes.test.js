import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import { databasePool } from '../database/pool.js';
import { getTripInspectionAnnexes, buildInspectionWithAnnexes, buildGerenciamientoWithAnnexes } from '../services/trip-inspection-annexes.service.js';

const db = new PGlite();
await db.exec(`CREATE TABLE conductores(id_conductores INT PRIMARY KEY,nombre TEXT);
 CREATE TABLE vehiculos(id_vehiculos INT PRIMARY KEY,nombre TEXT,numero_economico TEXT,placas TEXT);
 CREATE TABLE lugares(id_lugares INT PRIMARY KEY,nombre TEXT);
 CREATE TABLE viajes(id_viajes INT PRIMARY KEY,id_vehiculos INT,id_conductores INT,id_destino INT,folio TEXT,hora_salida TIMESTAMP);
 CREATE TABLE inspecciones_vehiculares(id_inspeccion INT PRIMARY KEY,id_viajes INT,id_vehiculos INT,id_conductores INT,fecha_operativa DATE,creado_en TIMESTAMP,estado TEXT);
 CREATE TABLE viajes_offline(id_viajes INT,id_inspeccion INT);
 CREATE TABLE trip_operation_items(id SERIAL PRIMARY KEY,trip_id INT,kind TEXT,name TEXT,trailer_id INT,inspection JSONB,initial_key TEXT,added_at TIMESTAMP,removed_at TIMESTAMP);
 INSERT INTO conductores VALUES(10,'Conductor de prueba'),(20,'Otro conductor');
 INSERT INTO vehiculos VALUES(1,'L200','AUTO-006','STG-1'),(2,'REMOLQUE DE PRUEBA','REM-001','STG-R');
 INSERT INTO lugares VALUES(1,'Destino');
 INSERT INTO viajes VALUES(1,1,10,1,'VJ-PRUEBA-001','2026-11-07 09:00'),(2,1,10,1,'VJ-PRUEBA-002','2026-11-07 11:00'),
 (3,1,20,1,'VJ-OTRO-CONDUCTOR','2026-11-07 13:00'),(4,1,10,1,'VJ-DESPUES-DE-OTRO','2026-11-07 14:00'),
 (5,1,10,1,'VJ-OTRO-DIA','2026-11-08 09:00'),(6,1,10,1,'VJ-OFFLINE','2026-11-07 12:00');
 INSERT INTO inspecciones_vehiculares VALUES(100,1,1,10,'2026-11-07','2026-11-07 08:00','APROBADA');
 INSERT INTO viajes_offline VALUES(6,100);`);
const migration = await readFile(new URL('../../../database/migrations/045_viaje_inspeccion_uso.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration);
databasePool.query = (sql, params) => db.query(sql, params);
after(async () => { await db.close(); if (!databasePool.ending) await databasePool.end(); });

test('la inspección diaria vincula viajes repetidos y offline sin cruzar conductor, día o uso posterior', async () => {
  const links = (await db.query('SELECT * FROM viaje_inspeccion_uso ORDER BY id_viajes')).rows;
  assert.deepEqual(links.map(row => row.id_viajes), [1,2,6]);
});

test('diez enganches generan diez anexos aunque tengan clave offline y usen la misma unidad en varios viajes', async () => {
  for (let n=0;n<10;n++) await db.query(`INSERT INTO trip_operation_items(trip_id,kind,name,trailer_id,inspection,initial_key,added_at,removed_at)
    VALUES($1,'trailer','REMOLQUE DE PRUEBA',2,$2,$3,$4,$5)`, [n<4?1:2,
    {source:'new',data:{captureId:crypto.randomUUID(),idRemolque:2,checklist:{'Luces de freno':'B'},danos:{frontal:[{x:40,y:45}]},observaciones:`ENGANCHE INDEPENDIENTE ${n+1}`}},
    n===0?null:`movement-${crypto.randomUUID()}_0`, `2026-11-07 ${n<4?'09':'11'}:${String(n).padStart(2,'0')}:00`, '2026-11-07 12:30:00']);
  await db.exec(`INSERT INTO trip_operation_items(trip_id,kind,name,trailer_id,inspection,initial_key,added_at)
    VALUES(1,'trailer','Inicial',2,'{}','initial-trailer','2026-11-07 09:00'),(3,'trailer','Ajeno',2,'{}',NULL,'2026-11-07 13:00');`);
  const all = await getTripInspectionAnnexes(1,{inspectionId:100});
  assert.equal(all.length,10);
  assert.equal(new Set(all.map(item=>item.inspection.data.captureId)).size,10);
  assert.equal((await getTripInspectionAnnexes(2)).length,6);
  const context={id_inspeccion:100,id_viajes:1,folio:'VJ-PRUEBA-001',estado:'APROBADA',conductor:'Conductor de prueba',vehiculo:'L200',numero_economico:'AUTO-006'};
  const pdf=await buildInspectionWithAnnexes(context);
  assert.equal((await PDFDocument.load(pdf.buffer)).getPageCount(),11);
  // El gerenciamiento solo anexa los enganches del viaje correspondiente.
  const managed=await buildGerenciamientoWithAnnexes({...context,id_viaje:2});
  assert.equal((await PDFDocument.load(managed.buffer)).getPageCount(),7);
  if(process.env.ANNEX_PDF_SAMPLE){await mkdir(new URL('../../../tmp/pdfs/',import.meta.url),{recursive:true});await writeFile(new URL('../../../tmp/pdfs/diez-enganches.pdf',import.meta.url),pdf.buffer);}
});
