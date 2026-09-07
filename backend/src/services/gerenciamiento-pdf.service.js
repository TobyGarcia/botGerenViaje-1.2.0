import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 20;
const CONTENT_WIDTH = 572; // 612 - 40

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

function formatDate(val) {
  if (!val) return "N/A";
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    const match = String(val).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return String(val).split("T")[0];
  }
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function color(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4]
    .map((i) => (parseInt(normalized.slice(i, i + 2), 16) / 255).toFixed(3))
    .join(" ");
}

function rect(commands, x, y, width, height, options = {}) {
  const { fill, stroke = "#000000", lineWidth = 0.6 } = options;
  commands.push(`q`);
  commands.push(`${lineWidth} w`);
  if (fill) commands.push(`${color(fill)} rg`);
  if (stroke) commands.push(`${color(stroke)} RG`);
  commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
  if (fill && stroke) commands.push("B");
  else if (fill) commands.push("f");
  else commands.push("S");
  commands.push(`Q`);
}

function line(commands, x1, y1, x2, y2, lineWidth = 0.6, strokeColor = "#000000") {
  commands.push(`q`);
  commands.push(`${lineWidth} w`);
  commands.push(`${color(strokeColor)} RG`);
  commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  commands.push(`Q`);
}

function drawText(commands, text, x, y, size = 8, options = {}) {
  const { bold = false, fill = "#000000", align = "left" } = options;
  const safeText = pdfEscape(text);
  const approxWidth = String(text).length * size * (bold ? 0.52 : 0.46);
  const alignedX = align === "right" ? x - approxWidth : align === "center" ? x - approxWidth / 2 : x;
  commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color(fill)} rg 1 0 0 1 ${alignedX.toFixed(2)} ${y.toFixed(2)} Tm (${safeText}) Tj ET`);
}

/**
 * Genera el PDF oficial para el Gerenciamiento de Viaje (SII-MX-23-LOG-003 v3.0).
 * Reproduce exactamente el formato de tabla cuadriculada para auditorías.
 */
export function buildGerenciamientoPdf(data = {}) {
  const folio = data.folio_documento || data.folio || "SII-MX-23-LOG-003";
  const version = data.version_documento || "3.0";
  const fecha = formatDate(data.fecha_emision || data.creado_en || new Date());
  const estado = String(data.estado || "PENDIENTE").toUpperCase();

  const conductorNombre = data.nombre_conductor || data.conductor_nombre || "N/A";
  const vehiculoTipo = data.tipo_vehiculo || "MITSUBISHI L200";
  const placa = data.placa || "N/A";
  const modelo = data.modelo || "L200";
  const colorVehiculo = data.color || "BLANCO";
  const noUnidad = data.numero_unidad || data.numero_economico || "AQR-028";
  const contratista = data.nombre_contratista || "N/A (AQUARIO)";
  const esVehiculoEmpresa = data.vehiculo_empresa !== false;

  const origen = data.origen_nombre || data.origen_texto || "Base Perú";
  const destino = data.destino_nombre || data.destino_texto || "Casa Uayamón";
  const kilometraje = `${data.kilometraje || 0} km`;
  const tiempoViaje = `${data.tiempo_viaje_horas || "1.50"} hrs`;

  const licenciaNo = data.licencia_numero || "N/A";
  const licenciaTipo = data.licencia_tipo || "Chofer";
  const licenciaVenc = formatDate(data.licencia_vencimiento);
  const telefono = data.telefono_conductor || "N/A";

  const rutaPuntos = Array.isArray(data.ruta_puntos) ? data.ruta_puntos.filter(Boolean) : [];
  const rutaTexto = rutaPuntos.length > 0 ? rutaPuntos.join(" -> ") : (data.ruta_texto || `${origen} -> ${destino}`);

  const acompanantesList = Array.isArray(data.acompanantes) ? data.acompanantes.map(a => typeof a === "object" ? a.nombre : a).join(", ") : "";
  const acompanantesTexto = acompanantesList || "Sin acompañantes";

  const sitios = Array.isArray(data.sitios_reporte) ? data.sitios_reporte : [];

  const puntajeTotal = data.puntaje_total ?? 15;
  const nivelRiesgo = String(data.nivel_riesgo || "BAJO").toUpperCase();

  const commands = [];

  // MARCO EXTERIOR COMPLETO
  rect(commands, MARGIN, MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - MARGIN * 2, { stroke: "#000000", lineWidth: 1.5 });

  // 1. ENCABEZADO OFICIAL
  rect(commands, MARGIN, 736, CONTENT_WIDTH, 36, { stroke: "#000000", lineWidth: 1 });
  line(commands, 140, 736, 140, 772, 1);
  line(commands, 450, 736, 450, 772, 1);

  drawText(commands, "AQUARIO", 80, 750, 13, { bold: true, align: "center", fill: "#0f172a" });
  drawText(commands, `CÓDIGO R2PLOG1 / ${folio}`, 295, 750, 10, { bold: true, align: "center" });

  drawText(commands, "Sistema: SGI", 456, 760, 7.5);
  drawText(commands, `Versión: ${version}`, 456, 750, 7.5);
  drawText(commands, "Página: 1 de 1", 456, 740, 7.5);

  // BANNER TITULO FECHA
  rect(commands, MARGIN, 720, CONTENT_WIDTH, 16, { fill: "#d1d5db", stroke: "#000000", lineWidth: 1 });
  drawText(commands, `GERENCIAMIENTO DE VIAJE (FECHA DE EMISIÓN: ${fecha})`, PAGE_WIDTH / 2, 724, 9, { bold: true, align: "center" });

  // FILA ORIGEN / DESTINO / DEPARTAMENTO / KILOMETRAJE
  rect(commands, MARGIN, 696, CONTENT_WIDTH, 24, { stroke: "#000000", lineWidth: 1 });
  line(commands, MARGIN, 708, PAGE_WIDTH - MARGIN, 708, 0.6);
  line(commands, 140, 696, 140, 720, 0.6);
  line(commands, 310, 696, 310, 720, 0.6);
  line(commands, 430, 696, 430, 720, 0.6);

  drawText(commands, "Origen", 80, 711, 8, { bold: true, align: "center" });
  drawText(commands, truncate(origen, 35), 146, 711, 8);
  drawText(commands, "Destino", 370, 711, 8, { bold: true, align: "center" });
  drawText(commands, truncate(destino, 35), 436, 711, 8);

  drawText(commands, "Departamento", 80, 699, 8, { bold: true, align: "center" });
  drawText(commands, data.departamento || "Logística", 146, 699, 8);
  drawText(commands, "Kilometraje", 370, 699, 8, { bold: true, align: "center" });
  drawText(commands, kilometraje, 436, 699, 8);

  // 2. SECCIÓN 1: INFORMACIÓN GENERAL
  rect(commands, MARGIN, 682, CONTENT_WIDTH, 14, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "1. INFORMACIÓN GENERAL", PAGE_WIDTH / 2, 685, 8.5, { bold: true, align: "center" });

  // GRID INFORMACIÓN GENERAL (y: 574 a 682)
  rect(commands, MARGIN, 574, CONTENT_WIDTH, 108, { stroke: "#000000", lineWidth: 1 });

  // Líneas horizontales de Información General
  [666, 650, 634, 618, 602, 588].forEach(yL => line(commands, MARGIN, yL, PAGE_WIDTH - MARGIN, yL, 0.6));

  // Filas 1-6
  // Row 1: Tipo vehículo | Placa | Modelo | Color
  line(commands, 110, 666, 110, 682, 0.6);
  line(commands, 260, 666, 260, 682, 0.6);
  line(commands, 330, 666, 330, 682, 0.6);
  line(commands, 450, 666, 450, 682, 0.6);
  line(commands, 500, 666, 500, 682, 0.6);
  drawText(commands, "Tipo de vehículo", 24, 670, 7.5, { bold: true });
  drawText(commands, truncate(vehiculoTipo, 22), 114, 670, 7.5);
  drawText(commands, "Placa", 264, 670, 7.5, { bold: true });
  drawText(commands, placa, 334, 670, 7.5);
  drawText(commands, "Modelo", 454, 670, 7.5, { bold: true });
  drawText(commands, modelo, 504, 670, 7.5);

  // Row 2: Vehículo empresa | Contratista | No. Unidad
  line(commands, 95, 650, 95, 666, 0.6);
  line(commands, 210, 650, 210, 666, 0.6);
  line(commands, 450, 650, 450, 666, 0.6);
  line(commands, 490, 650, 490, 666, 0.6);
  drawText(commands, "Vehículo empresa", 24, 654, 7.5, { bold: true });
  drawText(commands, esVehiculoEmpresa ? "[X] SÍ  [  ] NO" : "[  ] SÍ  [X] NO", 100, 654, 7.5, { bold: true });
  drawText(commands, "Nombre empresa contratista", 214, 654, 7.5, { bold: true });
  drawText(commands, truncate(contratista, 30), 335, 654, 7.5);
  drawText(commands, "No. Unidad", 454, 654, 7.5, { bold: true });
  drawText(commands, noUnidad, 494, 654, 7.5);

  // Row 3: Conductor | Tel. Celular
  line(commands, 100, 634, 100, 650, 0.6);
  line(commands, 380, 634, 380, 650, 0.6);
  line(commands, 450, 634, 450, 650, 0.6);
  drawText(commands, "Conductor", 24, 638, 7.5, { bold: true });
  drawText(commands, truncate(conductorNombre, 45), 104, 638, 8, { bold: true });
  drawText(commands, "Tel. Celular", 384, 638, 7.5, { bold: true });
  drawText(commands, telefono, 454, 638, 7.5);

  // Row 4: Licencia | Tipo | Vencimiento
  line(commands, 100, 618, 100, 634, 0.6);
  line(commands, 260, 618, 260, 634, 0.6);
  line(commands, 300, 618, 300, 634, 0.6);
  line(commands, 410, 618, 410, 634, 0.6);
  drawText(commands, "Número licencia", 24, 622, 7.5, { bold: true });
  drawText(commands, licenciaNo, 104, 622, 7.5);
  drawText(commands, "Tipo", 264, 622, 7.5, { bold: true });
  drawText(commands, licenciaTipo, 304, 622, 7.5);
  drawText(commands, "Fecha vencimiento", 414, 622, 7.5, { bold: true });
  drawText(commands, licenciaVenc, 510, 622, 7.5);

  // Row 5: Ruta a seguir | Tiempo Viaje
  line(commands, 100, 602, 100, 618, 0.6);
  line(commands, 450, 602, 450, 618, 0.6);
  line(commands, 515, 602, 515, 618, 0.6);
  drawText(commands, "Ruta a seguir", 24, 606, 7.5, { bold: true });
  drawText(commands, truncate(rutaTexto, 65), 104, 606, 7.5);
  drawText(commands, "Tiempo Viaje", 454, 606, 7.5, { bold: true });
  drawText(commands, tiempoViaje, 520, 606, 7.5);

  // Row 6: Acompañante(s)
  line(commands, 100, 588, 100, 602, 0.6);
  drawText(commands, "Acompañante(s)", 24, 592, 7.5, { bold: true });
  drawText(commands, truncate(acompanantesTexto, 70), 104, 592, 7.5);

  // Sitios de reporte (para viajes superiores a 1 hora)
  drawText(commands, "Sitios de reporte (para viajes superiores a 1 hora)", 24, 578, 7, { bold: true });

  // Grid Sitios Reporte (2 filas: y: 550 a 574)
  rect(commands, MARGIN, 546, CONTENT_WIDTH, 28, { stroke: "#000000", lineWidth: 0.6 });
  line(commands, MARGIN, 560, PAGE_WIDTH - MARGIN, 560, 0.6);
  line(commands, 60, 546, 60, 574, 0.6);
  line(commands, 240, 546, 240, 574, 0.6);
  line(commands, 275, 546, 275, 574, 0.6);
  line(commands, 310, 546, 310, 574, 0.6);
  line(commands, 350, 546, 350, 574, 0.6);
  line(commands, 525, 546, 525, 574, 0.6);
  line(commands, 555, 546, 555, 574, 0.6);

  const s1 = sitios[0] || {};
  const s2 = sitios[1] || {};
  const s3 = sitios[2] || {};
  const s4 = sitios[3] || {};

  drawText(commands, "Punto 1", 24, 564, 7, { bold: true });
  drawText(commands, truncate(s1.punto || "carretera merida, paraje turistico", 32), 64, 564, 7);
  drawText(commands, "Hora", 244, 564, 7, { bold: true });
  drawText(commands, s1.horaReportada || "--:--", 280, 564, 7);

  drawText(commands, "Punto 3", 314, 564, 7, { bold: true });
  drawText(commands, truncate(s3.punto || "paradero turistico Uyamón", 32), 354, 564, 7);
  drawText(commands, "Hora", 529, 564, 7, { bold: true });
  drawText(commands, s3.horaReportada || "--:--", 560, 564, 7);

  drawText(commands, "Punto 2", 24, 550, 7, { bold: true });
  drawText(commands, truncate(s2.punto || "entronque Chiná, gasolinera", 32), 64, 550, 7);
  drawText(commands, "Hora", 244, 550, 7, { bold: true });
  drawText(commands, s2.horaReportada || "--:--", 280, 550, 7);

  drawText(commands, "Punto 4", 314, 550, 7, { bold: true });
  drawText(commands, truncate(s4.punto || "N/A", 32), 354, 550, 7);
  drawText(commands, "Hora", 529, 550, 7, { bold: true });
  drawText(commands, s4.horaReportada || "--:--", 560, 550, 7);


  // 3. SECCIÓN 2: LISTA VERIFICACIÓN DE PREVIAJE
  rect(commands, MARGIN, 530, CONTENT_WIDTH, 14, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "2. LISTA VERIFICACIÓN DE PREVIAJE", PAGE_WIDTH / 2, 533, 8.5, { bold: true, align: "center" });

  // TABLA CHECKLIST PREVIAJE (y: 434 a 530)
  rect(commands, MARGIN, 434, CONTENT_WIDTH, 96, { stroke: "#000000", lineWidth: 1 });
  line(commands, 500, 434, 500, 530, 0.6);
  line(commands, 546, 434, 546, 530, 0.6);

  // Header Checklist
  rect(commands, MARGIN, 516, CONTENT_WIDTH, 14, { fill: "#f3f4f6", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "Pregunta de Control", 24, 520, 7.5, { bold: true });
  drawText(commands, "SI", 523, 520, 7.5, { bold: true, align: "center" });
  drawText(commands, "NO", 569, 520, 7.5, { bold: true, align: "center" });

  const preguntas = [
    { text: "1. ¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales)?", si: true },
    { text: "2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta padecimiento del sueño?", si: false },
    { text: "3. ¿El conductor ha dormido adecuadamente?", si: true },
    { text: "4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?", si: true },
    { text: "5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)", si: true },
    { text: "6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de 1 vehículo", si: false }
  ];

  preguntas.forEach((q, idx) => {
    const rowY = 504 - idx * 13;
    line(commands, MARGIN, rowY - 2, PAGE_WIDTH - MARGIN, rowY - 2, 0.5);
    drawText(commands, q.text, 24, rowY, 7);
    if (q.si) drawText(commands, "X", 523, rowY, 8, { bold: true, align: "center" });
    else drawText(commands, "X", 569, rowY, 8, { bold: true, align: "center" });
  });

  // 4. SECCIÓN 3: EVALUACIÓN DE RIESGO DE LA RUTA
  rect(commands, MARGIN, 418, CONTENT_WIDTH, 14, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "3. EVALUACIÓN DE RIESGO DE LA RUTA", PAGE_WIDTH / 2, 421, 8.5, { bold: true, align: "center" });

  // MATRIZ DE RIESGO SIDE-BY-SIDE (y: 250 a 418)
  rect(commands, MARGIN, 250, CONTENT_WIDTH, 168, { stroke: "#000000", lineWidth: 1 });

  // Tabuladores A, B, C (Fila 1)
  // Col A
  rect(commands, MARGIN, 350, 135, 68, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, MARGIN, 404, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "A. Distancia a Recorrer / Ptos", MARGIN + 67, 408, 6.5, { bold: true, align: "center" });
  drawText(commands, "Menos de 50 Km", MARGIN + 4, 394, 6.5); drawText(commands, "1", MARGIN + 125, 394, 6.5, { bold: true });
  drawText(commands, "Menos de 100 Km", MARGIN + 4, 381, 6.5); drawText(commands, "2", MARGIN + 125, 381, 6.5, { bold: true });
  drawText(commands, "Menos de 200 Km", MARGIN + 4, 368, 6.5); drawText(commands, "5", MARGIN + 125, 368, 6.5, { bold: true });
  drawText(commands, "Más de 200 Km", MARGIN + 4, 355, 6.5); drawText(commands, "8", MARGIN + 125, 355, 6.5, { bold: true });

  // Col B
  rect(commands, 155, 350, 135, 68, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, 155, 404, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "B. Clima / Ptos", 222, 408, 6.5, { bold: true, align: "center" });
  drawText(commands, "Seco / Cond. normales", 159, 394, 6.5); drawText(commands, "2", 280, 394, 6.5, { bold: true });
  drawText(commands, "Lluvia suave", 159, 381, 6.5); drawText(commands, "4", 280, 381, 6.5, { bold: true });
  drawText(commands, "Lluvia fuerte/niebla", 159, 368, 6.5); drawText(commands, "8", 280, 368, 6.5, { bold: true });
  drawText(commands, "Nieve", 159, 355, 6.5); drawText(commands, "10", 280, 355, 6.5, { bold: true });

  // Col C
  rect(commands, 290, 350, 135, 68, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, 290, 404, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "C. Vehículos y personas / Ptos", 357, 408, 6.5, { bold: true, align: "center" });
  drawText(commands, "2+ Vehi. 2+ pers.", 294, 394, 6.5); drawText(commands, "1", 415, 394, 6.5, { bold: true });
  drawText(commands, "2+ Vehi. 1+ pers.", 294, 381, 6.5); drawText(commands, "2", 415, 381, 6.5, { bold: true });
  drawText(commands, "1Vehi. 2+ pers.", 294, 368, 6.5); drawText(commands, "3", 415, 368, 6.5, { bold: true });
  drawText(commands, "1Vehi. 1 pers.", 294, 355, 6.5); drawText(commands, "6", 415, 355, 6.5, { bold: true });

  // EVALUACIÓN DEL VIAJE (Caja resumen derecha 425 a 592)
  rect(commands, 425, 295, 167, 123, { stroke: "#000000", lineWidth: 0.8, fill: "#ffffff" });
  rect(commands, 425, 404, 167, 14, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "EVALUACIÓN DEL VIAJE", 508, 408, 7.5, { bold: true, align: "center" });

  drawText(commands, "A: 2", 432, 390, 6.5);
  drawText(commands, "B: 4", 432, 378, 6.5);
  drawText(commands, "C: 3", 432, 366, 6.5);
  drawText(commands, "D: 2", 432, 354, 6.5);
  drawText(commands, "E: 0", 432, 342, 6.5);
  drawText(commands, "F: 3", 432, 330, 6.5);
  drawText(commands, "G: 1", 432, 318, 6.5);

  // Big Badge RIESGO BAJO/MEDIO/ALTO
  const badgeBg = nivelRiesgo === "ALTO" ? "#fee2e2" : nivelRiesgo === "MEDIO" ? "#fef9c3" : "#dcfce7";
  const badgeBorder = nivelRiesgo === "ALTO" ? "#ef4444" : nivelRiesgo === "MEDIO" ? "#eab308" : "#16a34a";
  rect(commands, 475, 318, 105, 58, { fill: badgeBg, stroke: badgeBorder, lineWidth: 1.5 });
  drawText(commands, `${puntajeTotal} pts`, 527, 350, 14, { bold: true, fill: "#0f172a", align: "center" });
  rect(commands, 482, 324, 91, 14, { fill: badgeBorder });
  drawText(commands, `RIESGO ${nivelRiesgo}`, 527, 328, 7.5, { bold: true, fill: "#ffffff", align: "center" });

  // Tabuladores D, E, F (Fila 2: y: 295 a 350)
  // Col D
  rect(commands, MARGIN, 295, 135, 55, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, MARGIN, 336, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "D. Condiciones de la Vía / Ptos", MARGIN + 67, 340, 6.5, { bold: true, align: "center" });
  drawText(commands, "Pavimentada", MARGIN + 4, 325, 6.5); drawText(commands, "1", MARGIN + 125, 325, 6.5, { bold: true });
  drawText(commands, "Mixta (<50% No Pav.)", MARGIN + 4, 312, 6.5); drawText(commands, "2", MARGIN + 125, 312, 6.5, { bold: true });
  drawText(commands, "No Pavimentada", MARGIN + 4, 299, 6.5); drawText(commands, "4", MARGIN + 125, 299, 6.5, { bold: true });

  // Col E
  rect(commands, 155, 295, 135, 55, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, 155, 336, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "E. Comunicaciones / Ptos", 222, 340, 6.5, { bold: true, align: "center" });
  drawText(commands, "Teléfono celular", 159, 325, 6.5); drawText(commands, "0", 280, 325, 6.5, { bold: true });
  drawText(commands, "Sin com. y caravana", 159, 312, 6.5); drawText(commands, "2", 280, 312, 6.5, { bold: true });
  drawText(commands, "Sin com. sin caravana", 159, 299, 6.5); drawText(commands, "4", 280, 299, 6.5, { bold: true });

  // Col F
  rect(commands, 290, 295, 135, 55, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, 290, 336, 135, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "F. Hrs. trabajadas + Viaje / Ptos", 357, 340, 6.5, { bold: true, align: "center" });
  drawText(commands, "Hrs. trab. + Viaje =< 12", 294, 325, 6.5); drawText(commands, "1", 415, 325, 6.5, { bold: true });
  drawText(commands, "Hrs. trab. + Viaje =< 14", 294, 312, 6.5); drawText(commands, "3", 415, 312, 6.5, { bold: true });
  drawText(commands, "Hrs. trab. + Viaje =< 16", 294, 299, 6.5); drawText(commands, "6", 415, 299, 6.5, { bold: true });

  // Tabulador G (y: 250 a 295)
  rect(commands, MARGIN, 250, 210, 45, { stroke: "#000000", lineWidth: 0.6 });
  rect(commands, MARGIN, 281, 210, 14, { fill: "#fef08a", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "G. Hora del Traslado / Ptos", MARGIN + 105, 285, 6.5, { bold: true, align: "center" });
  drawText(commands, "Día (06:00 a 18:00 h)", MARGIN + 4, 270, 6.5); drawText(commands, "1", 215, 270, 6.5, { bold: true });
  drawText(commands, "Noche (18:00 a 06:00 h)", MARGIN + 4, 256, 6.5); drawText(commands, "8", 215, 256, 6.5, { bold: true });

  // Warning Banner
  rect(commands, 230, 250, 362, 45, { fill: "#fef2f2", stroke: "#000000", lineWidth: 0.6 });
  drawText(commands, "Horas trabajo + Viaje > 16h = NO CONDUCIR", 411, 275, 7.5, { bold: true, fill: "#dc2626", align: "center" });
  drawText(commands, "Manejo Nocturno (>18h) requiere Aprobación GCO/QHSE.", 411, 260, 6.5, { fill: "#1e293b", align: "center" });

  // NOTA Y TABLA CLASIFICACIÓN (y: 200 a 245)
  drawText(commands, "NOTA: DE ACUERDO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN", PAGE_WIDTH / 2, 236, 6.5, { bold: true, align: "center" });

  rect(commands, MARGIN, 198, CONTENT_WIDTH, 34, { stroke: "#000000", lineWidth: 0.8 });
  line(commands, 210, 198, 210, 232, 0.6);
  line(commands, 400, 198, 400, 232, 0.6);

  rect(commands, MARGIN, 198, 190, 34, { fill: "#dcfce7" });
  drawText(commands, "RIESGO BAJO (0 A 15 PUNTOS)", 115, 220, 6.5, { bold: true, align: "center" });
  drawText(commands, "AUTORIZA SUPERVISOR DIRECTO Y QHSE", 115, 208, 6.5, { align: "center" });

  rect(commands, 210, 198, 190, 34, { fill: "#fef9c3" });
  drawText(commands, "RIESGO MEDIO (16 A 22 PUNTOS)", 305, 220, 6.5, { bold: true, align: "center" });
  drawText(commands, "COORDINACIONES DE AREA", 305, 208, 6.5, { align: "center" });

  rect(commands, 400, 198, 192, 34, { fill: "#fee2e2" });
  drawText(commands, "RIESGO ALTO (> 23 PUNTOS)", 496, 220, 6.5, { bold: true, align: "center" });
  drawText(commands, "AUTORIZA GERENCIA GENERAL", 496, 208, 6.5, { align: "center" });


  // 5. SECCIÓN FIRMAS (Fondo de página: y: 20 a 190)
  rect(commands, MARGIN, MARGIN, CONTENT_WIDTH, 175, { stroke: "#000000", lineWidth: 1 });
  line(commands, 163, MARGIN, 163, 195, 0.6);
  line(commands, 306, MARGIN, 306, 195, 0.6);
  line(commands, 449, MARGIN, 449, 195, 0.6);

  // Col 1: Conductor
  line(commands, 30, 65, 153, 65, 0.8);
  drawText(commands, truncate(conductorNombre, 25), 91, 52, 7.5, { bold: true, align: "center" });
  drawText(commands, "CONDUCTOR", 91, 38, 7, { bold: true, align: "center" });

  // Col 2: Supervisor Directo / QHSE
  const supNombre = data.nombre_autorizador_firma || "Eduardo Josue Tovar Garcia";
  line(commands, 173, 65, 296, 65, 0.8);
  drawText(commands, truncate(supNombre, 25), 234, 52, 7.5, { bold: true, align: "center" });
  drawText(commands, "NOMBRE Y FIRMA", 234, 42, 6.5, { bold: true, align: "center" });
  drawText(commands, "SUPERVISOR DIRECTO / QHSE", 234, 32, 6.5, { bold: true, align: "center" });

  // Col 3: Autoridad de Área / Coordinación
  line(commands, 316, 65, 439, 65, 0.8);
  drawText(commands, "NOMBRE Y FIRMA", 377, 42, 6.5, { bold: true, align: "center" });
  drawText(commands, "AUTORIDAD DE ÁREA / COORDINACIÓN", 377, 32, 6, { bold: true, align: "center" });

  // Col 4: Gerente de Área
  line(commands, 459, 65, 582, 65, 0.8);
  drawText(commands, "NOMBRE Y FIRMA", 520, 42, 6.5, { bold: true, align: "center" });
  drawText(commands, "GERENTE DE ÁREA", 520, 32, 6.5, { bold: true, align: "center" });

  const contentStream = Buffer.from(commands.join("\n"), "latin1");

  // Ensamblar PDF básico de 1 página en sintaxis PDF 1.4 pura
  const objects = [];

  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1");
  objects[3] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`, "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1");
  objects[5] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1");
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
