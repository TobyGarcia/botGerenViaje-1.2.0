import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { databasePool } from '../database/pool.js';
import { buildInspectionWithAnnexes, buildGerenciamientoWithAnnexes } from '../services/trip-inspection-annexes.service.js';

const original = databasePool.query;
after(async () => { databasePool.query = original; if (!databasePool.ending) await databasePool.end(); });
test('anexa una hoja independiente por enganche a ambos documentos', async () => {
  const data = { id_viajes: 7, id_viaje: 7, folio: 'PRUEBA-ANEXOS', conductor: 'Conductor de prueba', vehiculo: 'L200', numero_economico: 'L200-01', creado_en: '2026-11-02T15:00:00Z', checklist: {}, danos: {} };
  databasePool.query = async () => ({ rows: [1,2].map(id => ({ id, name: 'Remolque de prueba', trailer_id: 9, numero_economico: 'R-09', added_at: '2026-11-02T15:00:00Z',
    inspection: { data: { checklist: { 'Conector eléctrico': id === 1 ? 'M' : 'B' }, danos: { frontal: [{x:50,y:40}] }, observaciones: `Inspección nueva ${id}` } } })) });
  const inspection = await buildInspectionWithAnnexes(data);
  const management = await buildGerenciamientoWithAnnexes(data);
  assert.equal((await PDFDocument.load(inspection.buffer)).getPageCount(), 3);
  assert.equal((await PDFDocument.load(management.buffer)).getPageCount(), 3);
  await mkdir(new URL('../../../output/pdf/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../../output/pdf/inspeccion-anexos-prueba.pdf', import.meta.url), inspection.buffer);
});
