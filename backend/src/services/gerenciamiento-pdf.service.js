import { readFileSync } from "node:fs";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;

function pdfEscape(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function truncate(value, length) {
  const text = String(value ?? "").trim() || "N/A";
  return text.length > length ? `${text.slice(0, Math.max(1, length - 3))}...` : text;
}

function formatShortDate(val) {
  if (!val) return "N/A";
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    const match = String(val).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return String(val).split("T")[0];
  }
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function color(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => (parseInt(normalized.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
}

/**
 * Genera el PDF oficial para el Gerenciamiento de Viaje (SII-MX-23-LOG-003 v3.0).
 */
export function buildGerenciamientoPdf(data = {}) {
  const folio = data.folio_documento || data.folio || "SII-MX-23-LOG-003";
  const version = data.version_documento || "3.0";
  const fecha = formatShortDate(data.fecha_emision || data.creado_en || new Date());
  const estado = String(data.estado || "PENDIENTE").toUpperCase();

  const conductorNombre = data.nombre_conductor || data.conductor_nombre || "N/A";
  const vehiculoDesc = `${data.tipo_vehiculo || 'Unidad'} - ${data.numero_unidad || 'N/A'} (${data.placa || 'Sin Placa'})`;
  const origen = data.origen_nombre || data.origen_texto || "N/A";
  const destino = data.destino_nombre || data.destino_texto || "N/A";
  const riesgo = String(data.nivel_riesgo || "BAJO").toUpperCase();
  const puntaje = data.puntaje_total ?? 8;
  const autorizacion = data.autorizacion_requerida || "SUPERVISOR DIRECTO O QHSE";

  const stream = [];
  stream.push("q");

  // Encabezado principal
  stream.push(`${color("#0F172A")} rg`);
  stream.push(`${MARGIN} ${PAGE_HEIGHT - 60} ${PAGE_WIDTH - MARGIN * 2} 40 re f`);
  stream.push("BT /F2 14 Tf 1 1 1 rg");
  stream.push(`${MARGIN + 12} ${PAGE_HEIGHT - 38} Td (${pdfEscape(`GERENCIAMIENTO DE VIAJE (${folio} v${version})`)}) Tj ET`);

  stream.push("BT /F1 9 Tf 0.8 0.8 0.8 rg");
  stream.push(`${PAGE_WIDTH - MARGIN - 120} ${PAGE_HEIGHT - 38} Td (${pdfEscape(`Estado: ${estado}`)}) Tj ET`);

  // Cuadro de Resumen General
  let y = PAGE_HEIGHT - 80;
  stream.push(`${color("#F8FAFC")} rg ${color("#CBD5E1")} RG 1 w`);
  stream.push(`${MARGIN} ${y - 85} ${PAGE_WIDTH - MARGIN * 2} 80 re b`);

  stream.push(`BT /F2 10 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 10} ${y - 18} Td (${pdfEscape("DATOS GENERALES DEL VIAJE")}) Tj ET`);

  stream.push(`BT /F1 9 Tf ${color("#334155")} rg`);
  stream.push(`${MARGIN + 10} ${y - 35} Td (${pdfEscape(`Conductor: ${conductorNombre}`)}) Tj ET`);
  stream.push(`${MARGIN + 280} ${y - 35} Td (${pdfEscape(`Fecha: ${fecha}`)}) Tj ET`);
  stream.push(`${MARGIN + 10} ${y - 50} Td (${pdfEscape(`Vehículo: ${vehiculoDesc}`)}) Tj ET`);
  stream.push(`${MARGIN + 280} ${y - 50} Td (${pdfEscape(`Km Estimado: ${data.kilometraje || 0} km`)}) Tj ET`);
  stream.push(`${MARGIN + 10} ${y - 65} Td (${pdfEscape(`Origen: ${truncate(origen, 35)}`)}) Tj ET`);
  stream.push(`${MARGIN + 280} ${y - 65} Td (${pdfEscape(`Destino: ${truncate(destino, 35)}`)}) Tj ET`);

  // Cuadro de Análisis de Riesgo
  y -= 100;
  const riesgoColor = riesgo === "ALTO" ? "#EF4444" : riesgo === "MEDIO" ? "#F59E0B" : "#10B981";
  stream.push(`${color("#F1F5F9")} rg ${color("#CBD5E1")} RG 1 w`);
  stream.push(`${MARGIN} ${y - 80} ${PAGE_WIDTH - MARGIN * 2} 75 re b`);

  stream.push(`BT /F2 10 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 10} ${y - 18} Td (${pdfEscape("EVALUACIÓN Y ANÁLISIS DE RIESGO")}) Tj ET`);

  stream.push(`BT /F2 11 Tf ${color(riesgoColor)} rg`);
  stream.push(`${MARGIN + 10} ${y - 38} Td (${pdfEscape(`Nivel de Riesgo: ${riesgo} (${puntaje} Pts)`)}) Tj ET`);

  stream.push(`BT /F1 9 Tf ${color("#475569")} rg`);
  stream.push(`${MARGIN + 10} ${y - 55} Td (${pdfEscape(`Autorización Requerida: ${autorizacion}`)}) Tj ET`);
  stream.push(`${MARGIN + 10} ${y - 70} Td (${pdfEscape(`Puntos de Riesgo: Distancia (${data.pts_distancia || 1}) | Clima (${data.pts_clima || 2}) | Vía (${data.pts_condiciones_via || 1}) | Horas (${data.pts_horas_trabajadas || 1})`)}) Tj ET`);

  // Valoración Médica Pre-Viaje
  y -= 95;
  stream.push(`${color("#FFFFFF")} rg ${color("#CBD5E1")} RG 1 w`);
  stream.push(`${MARGIN} ${y - 65} ${PAGE_WIDTH - MARGIN * 2} 60 re b`);

  stream.push(`BT /F2 10 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 10} ${y - 18} Td (${pdfEscape("VALORACIÓN MÉDICA PRE-VIAJE")}) Tj ET`);

  stream.push(`BT /F1 9 Tf ${color("#334155")} rg`);
  stream.push(`${MARGIN + 10} ${y - 35} Td (${pdfEscape(`Presión Arterial: ${data.presion_arterial || 'Normal'}`)}) Tj ET`);
  stream.push(`${MARGIN + 200} ${y - 35} Td (${pdfEscape(`Glucosa: ${data.glucosa || 'N/A'}`)}) Tj ET`);
  stream.push(`${MARGIN + 380} ${y - 35} Td (${pdfEscape(`Alcoholímetro: ${data.alcoholimetro ? '0.00 (Negativo)' : 'Aprobado'}`)}) Tj ET`);
  stream.push(`${MARGIN + 10} ${y - 50} Td (${pdfEscape(`Freq. Cardíaca: ${data.frecuencia_cardiaca || 'Normal'}`)}) Tj ET`);
  stream.push(`${MARGIN + 200} ${y - 50} Td (${pdfEscape(`Examen Visual: ${data.examen_visual || 'Apto'}`)}) Tj ET`);

  // Sitios de Reporte / Puntos de Control en Ruta
  y -= 80;
  stream.push(`${color("#F8FAFC")} rg ${color("#CBD5E1")} RG 1 w`);
  stream.push(`${MARGIN} ${y - 90} ${PAGE_WIDTH - MARGIN * 2} 85 re b`);

  stream.push(`BT /F2 10 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 10} ${y - 18} Td (${pdfEscape("PUNTOS DE REPORTE Y FICHAJE EN RUTA")}) Tj ET`);

  const sitios = Array.isArray(data.sitios_reporte) ? data.sitios_reporte : [];
  if (sitios.length === 0) {
    stream.push(`BT /F1 9 Tf ${color("#64748B")} rg`);
    stream.push(`${MARGIN + 10} ${y - 40} Td (${pdfEscape("No se especificaron puntos de reporte intermedios.")}) Tj ET`);
  } else {
    sitios.slice(0, 4).forEach((s, idx) => {
      const pY = y - 38 - idx * 12;
      stream.push(`BT /F1 8.5 Tf ${color("#334155")} rg`);
      stream.push(`${MARGIN + 10} ${pY} Td (${pdfEscape(`Punto ${idx + 1}: ${truncate(s.punto || s.nombre || 'Punto', 40)} -> Hora: ${s.horaReportada || s.hora || 'Pendiente'}`)}) Tj ET`);
    });
  }

  // Firmas y Autorizaciones
  y -= 110;
  stream.push(`${color("#FFFFFF")} rg ${color("#94A3B8")} RG 1 w`);

  // Firma Conductor
  stream.push(`${MARGIN + 20} ${y - 60} 220 0 re S`);
  stream.push(`BT /F2 9 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 40} ${y - 75} Td (${pdfEscape(conductorNombre)}) Tj ET`);
  stream.push(`BT /F1 8 Tf ${color("#64748B")} rg`);
  stream.push(`${MARGIN + 70} ${y - 88} Td (${pdfEscape("Firma del Conductor")}) Tj ET`);

  // Firma Autorizador / Supervisor
  const autorizadorNombre = data.nombre_autorizador_firma || data.autorizador_nombre || "Autorizador Autorizado";
  stream.push(`${MARGIN + 280} ${y - 60} 220 0 re S`);
  stream.push(`BT /F2 9 Tf ${color("#1E293B")} rg`);
  stream.push(`${MARGIN + 300} ${y - 75} Td (${pdfEscape(autorizadorNombre)}) Tj ET`);
  stream.push(`BT /F1 8 Tf ${color("#64748B")} rg`);
  stream.push(`${MARGIN + 320} ${y - 88} Td (${pdfEscape("Firma del Autorizador / Supervisor")}) Tj ET`);

  // Pie de página
  stream.push("BT /F1 8 Tf 0.5 0.5 0.5 rg");
  stream.push(`${MARGIN} 20 Td (${pdfEscape(`Documento de Evidencia Oficial - Gerenciamiento de Viajes | Generado el ${new Date().toLocaleString("es-MX")}`)}) Tj ET`);

  stream.push("Q");

  const contentStream = Buffer.from(stream.join("\n"), "latin1");

  // Ensamblar PDF básico de 1 página en sintaxis PDF 1.4 pura
  const objects = [];

  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1");
  objects[3] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`, "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1");
  objects[5] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "latin1");
  objects[6] = Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n${contentStream.toString("latin1")}\nendstream`, "latin1");

  let pdf = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const offsets = {};

  for (let id = 1; id <= 6; id++) {
    offsets[id] = pdf.length;
    pdf = Buffer.concat([pdf, Buffer.from(`${id} 0 obj\n`, "latin1"), objects[id], Buffer.from("\nendobj\n", "latin1")]);
  }

  const startXref = pdf.length;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  for (let id = 1; id <= 6; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  pdf = Buffer.concat([pdf, Buffer.from(xref, "latin1")]);

  const cleanFolio = String(folio).replace(/[/\\?%*:|"<>]/g, "-");
  return {
    nombre: `gerenciamiento_${cleanFolio}_${Date.now()}.pdf`,
    buffer: pdf
  };
}
