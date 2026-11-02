import { PDFDocument } from 'pdf-lib';
import { databasePool } from '../database/pool.js';
import { buildInspectionPdf } from './inspeccion-pdf.service.js';
import { buildGerenciamientoPdf } from './gerenciamiento-pdf.service.js';

export async function getTripInspectionAnnexes(tripId) {
  if (!tripId) return [];
  const result = await databasePool.query(`SELECT t.*, v.numero_economico, v.placas
    FROM trip_operation_items t LEFT JOIN vehiculos v ON v.id_vehiculos=t.trailer_id
    WHERE t.trip_id=$1 AND t.kind='trailer' AND t.inspection IS NOT NULL
      AND t.initial_key IS NULL ORDER BY t.added_at,t.id`, [tripId]);
  return result.rows;
}

export async function appendTripInspectionAnnexes(pdf, tripId, context = {}) {
  const items = await getTripInspectionAnnexes(tripId);
  if (!items.length) return pdf;
  const trip = await databasePool.query(`SELECT c.nombre AS conductor, v.nombre AS vehiculo, v.numero_economico, v.placas,
    destino.nombre AS destino FROM viajes t LEFT JOIN conductores c ON c.id_conductores=t.id_conductores
    LEFT JOIN vehiculos v ON v.id_vehiculos=t.id_vehiculos LEFT JOIN lugares destino ON destino.id_lugares=t.id_destino
    WHERE t.id_viajes=$1`, [tripId]);
  context = { ...context, ...trip.rows[0] };
  const document = await PDFDocument.load(pdf.buffer);
  for (const item of items) {
    const snapshot = item.inspection;
    const inspection = snapshot.data || snapshot.inspeccion_remolque;
    if (!inspection) continue;
    const generated = buildInspectionPdf({ ...context, folio: `${context.folio || context.folio_documento || tripId} / ENG-${item.id}`,
      lleva_remolque: true, id_remolque: item.trailer_id, remolque_numero_economico: inspection.remolqueObj?.numero_economico || item.numero_economico || item.name,
      remolque_placas: inspection.remolqueObj?.placas || item.placas, inspeccion_remolque: inspection,
      aprobado_en: null, aprobador: 'Pendiente de revisión', creado_en: item.added_at,
      firma_conductor: null, firma_supervisor: null });
    const source = await PDFDocument.load(generated.buffer);
    // La primera página corresponde a la unidad: anexar solo la hoja de remolque.
    const pages = await document.copyPages(source, source.getPageIndices().slice(1));
    for (const page of pages) document.addPage(page);
  }
  return { ...pdf, buffer: Buffer.from(await document.save()) };
}

export const buildInspectionWithAnnexes = data => appendTripInspectionAnnexes(buildInspectionPdf(data), data.id_viajes, data);
export const buildGerenciamientoWithAnnexes = data => appendTripInspectionAnnexes(buildGerenciamientoPdf(data), data.id_viaje, data);
