import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;

function pdfEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function truncate(value, length) {
  const text = String(value ?? "").trim() || "N/A";
  return text.length > length ? `${text.slice(0, Math.max(1, length - 3))}...` : text;
}

function rect(commands, x, y, w, h, { fill, stroke, lineWidth = 1 } = {}) {
  commands.push(`q`);
  commands.push(`${lineWidth} w`);
  if (fill) {
    const c = color(fill);
    commands.push(`${c} rg`);
  }
  if (stroke) {
    const c = color(stroke);
    commands.push(`${c} RG`);
  }
  commands.push(`${x} ${y} ${w} ${h} re`);
  if (fill && stroke) commands.push("B");
  else if (fill) commands.push("f");
  else commands.push("S");
  commands.push(`Q`);
}

function line(commands, x1, y1, x2, y2, lineWidth = 1, strokeColor = "#cccccc") {
  commands.push(`q`);
  commands.push(`${lineWidth} w`);
  commands.push(`${color(strokeColor)} RG`);
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  commands.push(`Q`);
}

function color(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4]
    .map((i) => (parseInt(normalized.slice(i, i + 2), 16) / 255).toFixed(3))
    .join(" ");
}

function drawText(commands, text, x, y, size, { bold = false, fill = "#1a1a1a", align = "left" } = {}) {
  commands.push("BT");
  commands.push(`/${bold ? "F2" : "F1"} ${size} Tf`);
  commands.push(`${color(fill)} rg`);
  if (align === "center") {
    const approxWidth = text.length * size * 0.48;
    commands.push(`1 0 0 1 ${(x - approxWidth / 2).toFixed(2)} ${y.toFixed(2)} Tm`);
  } else if (align === "right") {
    const approxWidth = text.length * size * 0.48;
    commands.push(`1 0 0 1 ${(x - approxWidth).toFixed(2)} ${y.toFixed(2)} Tm`);
  } else {
    commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
  }
  commands.push(`(${pdfEscape(text)}) Tj`);
  commands.push("ET");
}

export function generateManejoComentadoPDF(data) {
  const objects = ["", "<< /Type /Catalog /Pages 2 0 R >>", ""];
  const addObject = (content) => {
    objects.push(content);
    return objects.length - 1;
  };
  const regularFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const commands = [];
  const primaryColor = "#0f172a";
  const accentColor = data.estado_evaluacion === "APROBADO" ? "#16a34a" : "#dc2626";
  const border = "#cbd5e1";

  // Header Banner
  rect(commands, MARGIN, 710, 540, 46, { fill: primaryColor });
  drawText(commands, "FORMATO DE EVALUACIÓN DE MANEJO COMENTADO", PAGE_WIDTH / 2, 735, 14, { bold: true, fill: "#ffffff", align: "center" });
  drawText(commands, "ASPROMEX / SISTEMA DE GERENCIAMIENTO DE VIAJES", PAGE_WIDTH / 2, 718, 9, { fill: "#94a3b8", align: "center" });

  // Status Badge
  rect(commands, 450, 665, 126, 32, { fill: accentColor, stroke: border });
  drawText(commands, data.estado_evaluacion || "PENDIENTE", 513, 676, 12, { bold: true, fill: "#ffffff", align: "center" });

  // Driver Info Grid
  rect(commands, MARGIN, 665, 400, 32, { stroke: border, fill: "#f8fafc" });
  drawText(commands, "CONDUCTOR:", MARGIN + 10, 684, 8, { bold: true, fill: "#475569" });
  drawText(commands, truncate(data.conductor_nombre, 35), MARGIN + 70, 684, 9, { bold: true, fill: primaryColor });
  drawText(commands, "EMPRESA:", MARGIN + 230, 684, 8, { bold: true, fill: "#475569" });
  drawText(commands, truncate(data.empresa || "N/A", 20), MARGIN + 280, 684, 9, { bold: true, fill: primaryColor });

  // Details Section
  rect(commands, MARGIN, 595, 540, 60, { stroke: border });
  drawText(commands, "FECHA DE EVALUACIÓN:", MARGIN + 10, 638, 8, { bold: true, fill: "#475569" });
  drawText(commands, data.fecha_evaluacion ? new Date(data.fecha_evaluacion).toLocaleDateString("es-MX") : "N/A", MARGIN + 125, 638, 9, { fill: primaryColor });

  drawText(commands, "VIGENCIA HASTA:", MARGIN + 230, 638, 8, { bold: true, fill: "#475569" });
  drawText(commands, data.fecha_vencimiento ? new Date(data.fecha_vencimiento).toLocaleDateString("es-MX") : "6 meses tras aprobación", MARGIN + 315, 638, 9, { fill: primaryColor });

  drawText(commands, "EVALUADOR / INSTRUCTOR:", MARGIN + 10, 610, 8, { bold: true, fill: "#475569" });
  drawText(commands, truncate(data.evaluador_nombre || "Instructor autorizado", 30), MARGIN + 140, 610, 9, { fill: primaryColor });

  drawText(commands, "CALIFICACIÓN OBTENIDA:", MARGIN + 330, 610, 8, { bold: true, fill: "#475569" });
  drawText(commands, `${Number(data.calificacion || 0).toFixed(1)} / 100`, MARGIN + 450, 610, 11, { bold: true, fill: accentColor });

  // Rubric / Evaluation Breakdown
  rect(commands, MARGIN, 570, 540, 18, { fill: "#e2e8f0" });
  drawText(commands, "RUBROS EVALUADOS EN LA PRÁCTICA DE MANEJO COMENTADO", PAGE_WIDTH / 2, 575, 9, { bold: true, fill: primaryColor, align: "center" });

  const rubroTop = 550;
  const rubros = [
    { key: "inspeccion_previa", label: "1. Inspección Pre-operacional del vehículo" },
    { key: "postura_cinturon", label: "2. Postura de manejo y uso de cinturón de seguridad" },
    { key: "espejos_puntos_ciegos", label: "3. Ajuste y consulta periódica de espejos y puntos ciegos" },
    { key: "arranque_aceleracion", label: "4. Técnica de arranque y aceleración graduada" },
    { key: "frenado_distancia", label: "5. Distancia de seguimiento y anticipación de frenado" },
    { key: "direccionales_carril", label: "6. Uso oportuno de direccionales y cambio de carril" },
    { key: "respeto_senales", label: "7. Respeto a límites de velocidad y señales de tránsito" },
    { key: "comentarios_orales", label: "8. Narración y consciencia situacional (Manejo Comentado)" }
  ];

  rubros.forEach((r, idx) => {
    const y = rubroTop - idx * 24;
    rect(commands, MARGIN, y, 540, 24, { stroke: border, fill: idx % 2 === 0 ? "#ffffff" : "#f8fafc" });
    drawText(commands, r.label, MARGIN + 10, y + 7, 8.5, { fill: primaryColor });
    const score = data.rubrica?.[r.key] ?? "Cumple";
    drawText(commands, String(score), MARGIN + 470, y + 7, 8.5, { bold: true, fill: accentColor });
  });

  // Evaluator Comments Section
  const commentsTop = 330;
  rect(commands, MARGIN, commentsTop, 540, 18, { fill: "#e2e8f0" });
  drawText(commands, "OBSERVACIONES Y COMENTARIOS DEL EVALUADOR", PAGE_WIDTH / 2, commentsTop + 5, 9, { bold: true, fill: primaryColor, align: "center" });

  rect(commands, MARGIN, 210, 540, 120, { stroke: border });
  const commentText = truncate(data.comentarios || "Sin observaciones adicionales registrados durante la evaluación.", 300);
  drawText(commands, commentText, MARGIN + 10, 310, 8.5, { fill: primaryColor });

  // Signatures
  line(commands, MARGIN + 40, 110, MARGIN + 220, 110, 1, "#475569");
  drawText(commands, "Firma del Conductor Evaluado", MARGIN + 130, 95, 8, { bold: true, fill: primaryColor, align: "center" });

  line(commands, MARGIN + 320, 110, MARGIN + 500, 110, 1, "#475569");
  drawText(commands, "Firma del Instructor / Evaluador", MARGIN + 410, 95, 8, { bold: true, fill: primaryColor, align: "center" });

  // Footer Note
  drawText(commands, "Este documento consta como registro histórico de la evaluación de manejo comentado (Validez: 6 meses).", PAGE_WIDTH / 2, 45, 7.5, { fill: "#64748b", align: "center" });

  const content = Buffer.from(commands.join("\n"), "latin1");
  const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${commands.join("\n")}\nendstream`);
  const pageId = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${contentId} 0 R >>`);
  objects[2] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    const body = Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id], "latin1");
    pdf = Buffer.concat([pdf, Buffer.from(`${id} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
  }
  const startXref = pdf.length;
  let trailer = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) trailer += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return {
    buffer: Buffer.concat([pdf, Buffer.from(trailer, "latin1")]),
    nombre: `manejo-comentado-${data.id_evaluacion || Date.now()}.pdf`
  };
}

export function saveEvaluationPDFLocally(pdfResult) {
  try {
    const uploadDir = join(process.cwd(), "uploads", "evaluaciones");
    mkdirSync(uploadDir, { recursive: true });
    const filePath = join(uploadDir, pdfResult.nombre);
    writeFileSync(filePath, pdfResult.buffer);
    return `/uploads/evaluaciones/${pdfResult.nombre}`;
  } catch (error) {
    console.error("Error guardando PDF localmente:", error);
    return null;
  }
}
