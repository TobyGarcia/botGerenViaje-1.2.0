import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 20;
const CONTENT_WIDTH = 572; // 612 - 40

const logoAquarioUrl = new URL("../assets/aquario-logo.png", import.meta.url);

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

function formatDateParts(val) {
  let dia = "08";
  let mes = "09";
  let anio = "2026";
  if (val) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      dia = String(d.getUTCDate()).padStart(2, "0");
      mes = String(d.getUTCMonth() + 1).padStart(2, "0");
      anio = String(d.getUTCFullYear());
    } else {
      const match = String(val).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
      if (match) {
        anio = match[1];
        mes = match[2];
        dia = match[3];
      }
    }
  }
  return { dia, mes, anio, formatted: `${dia}/${mes}/${anio}` };
}

function color(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4]
    .map((i) => (parseInt(normalized.slice(i, i + 2), 16) / 255).toFixed(3))
    .join(" ");
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function readPng(buffer, bgRgb = [255, 255, 255]) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("La imagen no es un PNG válido.");
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlaceMethod;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlaceMethod = data[12];
    }
    if (type === "IDAT") chunks.push(data);
    if (type === "IEND") break;
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlaceMethod !== 0) {
    throw new Error("El PNG debe usar RGB o RGBA de 8 bits sin entrelazado.");
  }
  const channels = colorType === 6 ? 4 : 3;
  const rowLength = width * channels;
  const decoded = inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(rowLength * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = decoded[sourceOffset++];
    const rowStart = row * rowLength;
    for (let column = 0; column < rowLength; column += 1) {
      const value = decoded[sourceOffset++];
      const left = column >= channels ? pixels[rowStart + column - channels] : 0;
      const up = row > 0 ? pixels[rowStart - rowLength + column] : 0;
      const upperLeft = row > 0 && column >= channels ? pixels[rowStart - rowLength + column - channels] : 0;
      if (filter === 0) pixels[rowStart + column] = value;
      else if (filter === 1) pixels[rowStart + column] = (value + left) & 255;
      else if (filter === 2) pixels[rowStart + column] = (value + up) & 255;
      else if (filter === 3) pixels[rowStart + column] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) pixels[rowStart + column] = (value + paeth(left, up, upperLeft)) & 255;
      else throw new Error("Filtro PNG no compatible.");
    }
  }
  if (channels === 3) return { width, height, data: deflateSync(pixels) };

  // Aplanar transparencia sobre fondo blanco
  const [bgR, bgG, bgB] = bgRgb;
  const rgbPixels = Buffer.alloc(width * height * 3);
  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
    const alpha = pixels[source + 3] / 255;
    rgbPixels[target] = Math.round(pixels[source] * alpha + bgR * (1 - alpha));
    rgbPixels[target + 1] = Math.round(pixels[source + 1] * alpha + bgG * (1 - alpha));
    rgbPixels[target + 2] = Math.round(pixels[source + 2] * alpha + bgB * (1 - alpha));
  }
  return { width, height, data: deflateSync(rgbPixels) };
}

function imageFromDataUrl(dataUrl) {
  if (!String(dataUrl || "").startsWith("data:image/png;base64,")) return null;
  try {
    return readPng(Buffer.from(dataUrl.split(",")[1], "base64"), [255, 255, 255]);
  } catch {
    return null;
  }
}

function streamObject(dictionary, data) {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, "latin1"),
    data,
    Buffer.from("\nendstream", "latin1")
  ]);
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

function drawImage(commands, name, image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const drawnX = x + (width - drawnWidth) / 2;
  const drawnY = y + (height - drawnHeight) / 2;
  commands.push(`q ${drawnWidth.toFixed(2)} 0 0 ${drawnHeight.toFixed(2)} ${drawnX.toFixed(2)} ${drawnY.toFixed(2)} cm /${name} Do Q`);
}

/**
 * Genera el PDF oficial para el Gerenciamiento de Viaje (SII-MX-23-LOG-003 v3.0).
 * Reproduce fielmente la plantilla institucional SII-MX-23-LOG-003 con firmas y logotipo.
 */
export function buildGerenciamientoPdf(data = {}) {
  const folio = data.folio_documento || data.folio || "SII-MX-23-LOG-003";
  const version = data.version_documento || "3.0";
  const { dia, mes, anio, formatted: fechaStr } = formatDateParts(data.fecha_emision || data.creado_en);

  let horaSalida = data.hora_salida || data.horaSalida || "";
  if (!horaSalida && data.fecha_emision) {
    const d = new Date(data.fecha_emision);
    if (!isNaN(d.getTime())) {
      horaSalida = `${String(d.getHours()).padStart(2, "0")} : ${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }
  if (!horaSalida) horaSalida = "12 : 00";

  const conductorNombre = data.nombre_conductor || data.conductor_nombre || "Eduardo Josué Tovar García";
  const vehiculoTipo = data.tipo_vehiculo || "MITSUBISHI L200";
  const placa = data.placa || "CN2549B";
  const modelo = data.modelo || "L200";
  const colorVehiculo = data.color || "BLANCO";
  const noUnidad = data.numero_unidad || data.numero_economico || "AQR-028";
  const contratista = data.nombre_contratista || "N/A (AQUARIO)";
  const esVehiculoEmpresa = data.vehiculo_empresa !== false;

  const origen = data.origen_nombre || data.origen_texto || "Base Perú";
  const destino = data.destino_nombre || data.destino_texto || "Casa Uayamón";
  const departamento = data.departamento || "Logística";
  const kilometraje = `${data.kilometraje || 9} km`;
  const tiempoViaje = `${data.tiempo_viaje_horas || "1.00"} hrs`;

  const licenciaNo = data.licencia_numero || "AQZ245";
  const licenciaTipo = data.licencia_tipo || "Conductor A";
  const licenciaVenc = data.licencia_vencimiento
    ? formatDateParts(data.licencia_vencimiento).anio + "-" + formatDateParts(data.licencia_vencimiento).mes + "-" + formatDateParts(data.licencia_vencimiento).dia
    : "2028-05-06";
  const telefono = data.telefono_conductor || "9811398836";

  const rutaPuntos = Array.isArray(data.ruta_puntos) ? data.ruta_puntos.filter(Boolean) : [];
  const rutaTexto = rutaPuntos.length > 0 ? rutaPuntos.join(" -> ") : (data.ruta_texto || data.origen_texto || "Gasolinera gulf aviación");

  const acompanantesList = Array.isArray(data.acompanantes)
    ? data.acompanantes.map(a => typeof a === "object" ? a.nombre : a).filter(Boolean).join(", ")
    : "";
  const acompanantesTexto = acompanantesList || "Sin acompañantes";

  const rawSitios = Array.isArray(data.sitios_reporte) ? data.sitios_reporte : [];
  const getSitio = (idx) => {
    const s = rawSitios[idx];
    if (!s) return { punto: "N/A", hora: "--:--" };
    if (typeof s === "string") return { punto: s, hora: "--:--" };
    return { punto: s.punto || s.nombre || "N/A", hora: s.horaReportada || s.hora || "--:--" };
  };
  const s1 = rawSitios.length > 0 ? getSitio(0) : { punto: "Gasolinera gulf aviación", hora: "--:--" };
  const s2 = getSitio(1);
  const s3 = getSitio(2);
  const s4 = getSitio(3);

  // Tabulador de Riesgos
  const ptsA = data.pts_distancia ?? 1;
  const ptsB = data.pts_clima ?? 2;
  const ptsC = data.pts_vehiculos_personas ?? 6;
  const ptsD = data.pts_condiciones_via ?? 1;
  const ptsE = data.pts_comunicaciones ?? 0;
  const ptsF = data.pts_horas_trabajadas ?? 1;
  const ptsG = data.pts_hora_traslado ?? 1;
  const puntajeTotal = data.puntaje_total ?? (ptsA + ptsB + ptsC + ptsD + ptsE + ptsF + ptsG);
  const nivelRiesgo = String(data.nivel_riesgo || (puntajeTotal > 22 ? "ALTO" : puntajeTotal > 15 ? "MEDIO" : "BAJO")).toUpperCase();

  // Firmas
  const supervisorNombre = data.nombre_autorizador_firma || data.nombre_autorizador || "Eduardo Josue Tovar Garcia";
  let logoImg = null;
  try {
    logoImg = readPng(readFileSync(fileURLToPath(logoAquarioUrl)), [255, 255, 255]);
  } catch (err) {
    console.error("[GerenciamientoPDF] Error al cargar aquario-logo.png:", err.message);
  }

  const firmaConductorImg = imageFromDataUrl(data.firma_conductor);
  const firmaSupervisorImg = imageFromDataUrl(data.firma_autorizador || data.firma_supervisor);

  // Armado de Objetos PDF
  const objects = [null];
  const addObject = (val) => { objects.push(val); return objects.length - 1; };
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";
  const regularFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const imageEntries = [];
  if (logoImg) imageEntries.push(["logo", logoImg]);
  if (firmaConductorImg) imageEntries.push(["firmaCond", firmaConductorImg]);
  if (firmaSupervisorImg) imageEntries.push(["firmaSup", firmaSupervisorImg]);

  const imageReferences = Object.fromEntries(
    imageEntries.map(([name, img], idx) => [
      name,
      {
        name: `Im${idx + 1}`,
        image: img,
        id: addObject(streamObject(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, img.data))
      }
    ])
  );

  const commands = [];

  // MARCO EXTERIOR COMPLETO (y: 35 a 772, h: 737)
  rect(commands, MARGIN, 35, CONTENT_WIDTH, 737, { stroke: "#000000", lineWidth: 1.2 });

  // 1. ENCABEZADO INSTITUCIONAL (y: 736 a 772, h: 36)
  rect(commands, MARGIN, 736, CONTENT_WIDTH, 36, { stroke: "#000000", lineWidth: 1 });
  line(commands, 130, 736, 130, 772, 1);
  line(commands, 438, 736, 438, 772, 1);

  // Logo AQUARIO (Cuadro Izquierdo)
  if (imageReferences.logo) {
    drawImage(commands, imageReferences.logo.name, imageReferences.logo.image, 24, 738, 102, 32);
  } else {
    drawText(commands, "AQUARIO", 75, 752, 11, { bold: true, align: "center", fill: "#0f172a" });
  }

  // Código Central
  drawText(commands, "CÓDIGO", 284, 757, 8.5, { bold: true, align: "center" });
  drawText(commands, `R2PLOG1 / ${folio}`, 284, 745, 8, { bold: true, align: "center" });

  // Datos Sistema (Cuadro Derecho)
  drawText(commands, "Sistema: SGI", 444, 761, 7);
  drawText(commands, `Versión: ${version}`, 444, 751, 7);
  drawText(commands, "Página: 1 de 1", 444, 741, 7);

  // 2. BANNER TÍTULO (y: 722 a 736, h: 14)
  rect(commands, MARGIN, 722, CONTENT_WIDTH, 14, { fill: "#f1f5f9", stroke: "#000000", lineWidth: 1 });
  drawText(commands, `GERENCIAMIENTO DE VIAJE (FECHA DE EMISIÓN: ${fechaStr})`, PAGE_WIDTH / 2, 726, 8, { bold: true, align: "center" });

  // 3. FILAS DE CONTROL (y: 682 a 722)
  // Fila 1: Fecha / Hora Salida / Folio (y: 708 a 722, h: 14)
  rect(commands, MARGIN, 708, CONTENT_WIDTH, 14, { stroke: "#000000", lineWidth: 0.6 });
  line(commands, 215, 708, 215, 722, 0.6);
  line(commands, 410, 708, 410, 722, 0.6);
  drawText(commands, "FECHA", 24, 712, 7, { bold: true });
  drawText(commands, `DÍA: ${dia} / MES: ${mes} / AÑO: ${anio}`, 80, 712, 7);
  drawText(commands, "HORA DE SALIDA", 220, 712, 7, { bold: true });
  drawText(commands, `HORA: ${horaSalida}`, 305, 712, 7);
  drawText(commands, "FOLIO", 415, 712, 7, { bold: true });
  drawText(commands, folio, 460, 712, 7);

  // Fila 2: Origen / Destino (y: 695 a 708, h: 13)
  rect(commands, MARGIN, 695, CONTENT_WIDTH, 13, { stroke: "#000000", lineWidth: 0.6 });
  line(commands, 305, 695, 305, 708, 0.6);
  drawText(commands, "ORIGEN", 24, 699, 7, { bold: true });
  drawText(commands, truncate(origen, 40), 80, 699, 7);
  drawText(commands, "DESTINO", 310, 699, 7, { bold: true });
  drawText(commands, truncate(destino, 40), 360, 699, 7);

  // Fila 3: Departamento / Kilometraje (y: 682 a 695, h: 13)
  rect(commands, MARGIN, 682, CONTENT_WIDTH, 13, { stroke: "#000000", lineWidth: 0.6 });
  line(commands, 305, 682, 305, 695, 0.6);
  drawText(commands, "DEPARTAMENTO", 24, 686, 7, { bold: true });
  drawText(commands, departamento, 95, 686, 7);
  drawText(commands, "KILOMETRAJE", 310, 686, 7, { bold: true });
  drawText(commands, kilometraje, 375, 686, 7);

  // 4. SECCIÓN 1: INFORMACIÓN GENERAL
  rect(commands, MARGIN, 669, CONTENT_WIDTH, 13, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "1. INFORMACIÓN GENERAL", PAGE_WIDTH / 2, 673, 8, { bold: true, align: "center" });

  // Grid Info General (y: 571 a 669, h: 98)
  rect(commands, MARGIN, 571, CONTENT_WIDTH, 98, { stroke: "#000000", lineWidth: 1 });
  [655, 641, 627, 613, 599, 585].forEach(yL => line(commands, MARGIN, yL, PAGE_WIDTH - MARGIN, yL, 0.6));

  // Row 1 (y: 655 a 669): Tipo de vehículo | Placa | Modelo | Color
  line(commands, 105, 655, 105, 669, 0.6);
  line(commands, 235, 655, 235, 669, 0.6);
  line(commands, 275, 655, 275, 669, 0.6);
  line(commands, 345, 655, 345, 669, 0.6);
  line(commands, 390, 655, 390, 669, 0.6);
  line(commands, 455, 655, 455, 669, 0.6);
  line(commands, 495, 655, 495, 669, 0.6);
  drawText(commands, "Tipo de vehículo", 24, 659, 7, { bold: true });
  drawText(commands, truncate(vehiculoTipo, 22), 110, 659, 7);
  drawText(commands, "Placa", 240, 659, 7, { bold: true });
  drawText(commands, placa, 280, 659, 7);
  drawText(commands, "Modelo", 350, 659, 7, { bold: true });
  drawText(commands, modelo, 395, 659, 7);
  drawText(commands, "Color", 460, 659, 7, { bold: true });
  drawText(commands, colorVehiculo, 500, 659, 7);

  // Row 2 (y: 641 a 655): Vehículo empresa | Nombre empresa contratista | No. Unidad
  line(commands, 100, 641, 100, 655, 0.6);
  line(commands, 200, 641, 200, 655, 0.6);
  line(commands, 325, 641, 325, 655, 0.6);
  line(commands, 445, 641, 445, 655, 0.6);
  line(commands, 495, 641, 495, 655, 0.6);
  drawText(commands, "Vehículo empresa", 24, 645, 7, { bold: true });
  drawText(commands, esVehiculoEmpresa ? "[ X ] SÍ   [   ] NO" : "[   ] SÍ   [ X ] NO", 105, 645, 7, { bold: true });
  drawText(commands, "Nombre empresa contratista", 205, 645, 7, { bold: true });
  drawText(commands, truncate(contratista, 26), 330, 645, 7);
  drawText(commands, "No. Unidad", 450, 645, 7, { bold: true });
  drawText(commands, noUnidad, 500, 645, 7);

  // Row 3 (y: 627 a 641): Conductor | Tel. Celular
  line(commands, 100, 627, 100, 641, 0.6);
  line(commands, 360, 627, 360, 641, 0.6);
  line(commands, 445, 627, 445, 641, 0.6);
  drawText(commands, "Conductor", 24, 631, 7, { bold: true });
  drawText(commands, truncate(conductorNombre, 45), 105, 631, 7.5, { bold: true });
  drawText(commands, "Tel. Celular", 365, 631, 7, { bold: true });
  drawText(commands, telefono, 450, 631, 7);

  // Row 4 (y: 613 a 627): Número licencia | Tipo | Fecha vencimiento
  line(commands, 100, 613, 100, 627, 0.6);
  line(commands, 245, 613, 245, 627, 0.6);
  line(commands, 280, 613, 280, 627, 0.6);
  line(commands, 360, 613, 360, 627, 0.6);
  line(commands, 445, 613, 445, 627, 0.6);
  drawText(commands, "Número licencia", 24, 617, 7, { bold: true });
  drawText(commands, licenciaNo, 105, 617, 7);
  drawText(commands, "Tipo", 250, 617, 7, { bold: true });
  drawText(commands, licenciaTipo, 285, 617, 7);
  drawText(commands, "Fecha vencimiento", 365, 617, 7, { bold: true });
  drawText(commands, licenciaVenc, 450, 617, 7);

  // Row 5 (y: 599 a 613): Ruta a seguir | Tiempo Viaje
  line(commands, 100, 599, 100, 613, 0.6);
  line(commands, 420, 599, 420, 613, 0.6);
  line(commands, 495, 599, 495, 613, 0.6);
  drawText(commands, "Ruta a seguir", 24, 603, 7, { bold: true });
  drawText(commands, truncate(rutaTexto, 65), 105, 603, 7);
  drawText(commands, "Tiempo Viaje", 425, 603, 7, { bold: true });
  drawText(commands, tiempoViaje, 500, 603, 7);

  // Row 6 (y: 585 a 599): Acompañante(s)
  line(commands, 100, 585, 100, 599, 0.6);
  drawText(commands, "Acompañante(s)", 24, 589, 7, { bold: true });
  drawText(commands, truncate(acompanantesTexto, 75), 105, 589, 7);

  // Row 7 (y: 571 a 585): Subtítulo Sitios de reporte
  drawText(commands, "Sitios de reporte (para viajes superiores a 1 hora)", 24, 575, 6.8, { bold: true });

  // Grid Sitios Reporte (y: 543 a 571, h: 28, 2 rows of 14)
  rect(commands, MARGIN, 543, CONTENT_WIDTH, 28, { stroke: "#000000", lineWidth: 0.6 });
  line(commands, MARGIN, 557, PAGE_WIDTH - MARGIN, 557, 0.6);
  line(commands, 58, 543, 58, 571, 0.6);
  line(commands, 235, 543, 235, 571, 0.6);
  line(commands, 265, 543, 265, 571, 0.6);
  line(commands, 295, 543, 295, 571, 0.6);
  line(commands, 335, 543, 335, 571, 0.6);
  line(commands, 525, 543, 525, 571, 0.6);
  line(commands, 555, 543, 555, 571, 0.6);

  // Sitios Fila 1 (Punto 1 y Punto 3)
  drawText(commands, "Punto 1", 24, 561, 6.8, { bold: true });
  drawText(commands, truncate(s1.punto, 32), 62, 561, 6.8);
  drawText(commands, "Hora", 240, 561, 6.8, { bold: true });
  drawText(commands, s1.hora, 268, 561, 6.8);

  drawText(commands, "Punto 3", 300, 561, 6.8, { bold: true });
  drawText(commands, truncate(s3.punto, 32), 340, 561, 6.8);
  drawText(commands, "Hora", 530, 561, 6.8, { bold: true });
  drawText(commands, s3.hora, 558, 561, 6.8);

  // Sitios Fila 2 (Punto 2 y Punto 4)
  drawText(commands, "Punto 2", 24, 547, 6.8, { bold: true });
  drawText(commands, truncate(s2.punto, 32), 62, 547, 6.8);
  drawText(commands, "Hora", 240, 547, 6.8, { bold: true });
  drawText(commands, s2.hora, 268, 547, 6.8);

  drawText(commands, "Punto 4", 300, 547, 6.8, { bold: true });
  drawText(commands, truncate(s4.punto, 32), 340, 547, 6.8);
  drawText(commands, "Hora", 530, 547, 6.8, { bold: true });
  drawText(commands, s4.hora, 558, 547, 6.8);

  // 5. SECCIÓN 2: LISTA VERIFICACIÓN DE PREVIAJE (y: 434 a 543)
  rect(commands, MARGIN, 530, CONTENT_WIDTH, 13, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "2. LISTA VERIFICACIÓN DE PREVIAJE", PAGE_WIDTH / 2, 534, 8, { bold: true, align: "center" });

  rect(commands, MARGIN, 434, CONTENT_WIDTH, 96, { stroke: "#000000", lineWidth: 1 });
  line(commands, 510, 434, 510, 530, 0.6);
  line(commands, 551, 434, 551, 530, 0.6);

  // Header Checklist
  line(commands, MARGIN, 518, PAGE_WIDTH - MARGIN, 518, 0.6);
  drawText(commands, "Pregunta de Control", 24, 521, 7, { bold: true });
  drawText(commands, "SI", 530, 521, 7, { bold: true, align: "center" });
  drawText(commands, "NO", 571, 521, 7, { bold: true, align: "center" });

  const preguntas = [
    { text: "1. ¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales)?", si: data.conocimiento_riesgos_locales !== false },
    { text: "2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta padecimiento del sueño?", si: data.medicamentos_sueno === true },
    { text: "3. ¿El conductor ha dormido adecuadamente?", si: data.dormido_adecuadamente !== false },
    { text: "4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?", si: data.prohibido_personal_ajeno !== false },
    { text: "5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)", si: data.inspeccion_vehiculo_realizada !== false },
    { text: "6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de 1 vehículo", si: data.reunion_pre_caravana_realizada === true }
  ];

  preguntas.forEach((q, idx) => {
    const rowY = 504 - idx * 14;
    line(commands, MARGIN, rowY - 2, PAGE_WIDTH - MARGIN, rowY - 2, 0.5);
    drawText(commands, q.text, 24, rowY + 1, 6.5);
    if (q.si) drawText(commands, "X", 530, rowY + 1, 8, { bold: true, align: "center" });
    else drawText(commands, "X", 571, rowY + 1, 8, { bold: true, align: "center" });
  });

  // 6. SECCIÓN 3: EVALUACIÓN DE RIESGO DE LA RUTA (y: 265 a 434)
  rect(commands, MARGIN, 421, CONTENT_WIDTH, 13, { fill: "#e5e7eb", stroke: "#000000", lineWidth: 1 });
  drawText(commands, "3. EVALUACIÓN DE RIESGO DE LA RUTA", PAGE_WIDTH / 2, 425, 8, { bold: true, align: "center" });

  // Cuadrícula 3x3 simétrica (y: 265 a 421, h: 156)
  rect(commands, MARGIN, 265, CONTENT_WIDTH, 156, { stroke: "#000000", lineWidth: 1 });
  line(commands, 210.6, 265, 210.6, 421, 0.8);
  line(commands, 401.3, 265, 401.3, 421, 0.8);
  line(commands, MARGIN, 369, PAGE_WIDTH - MARGIN, 369, 0.8);
  line(commands, MARGIN, 317, PAGE_WIDTH - MARGIN, 317, 0.8);

  // --- FILA 1 (y: 369 a 421): A, B, C ---
  // Subheaders
  line(commands, MARGIN, 409, PAGE_WIDTH - MARGIN, 409, 0.6);
  drawText(commands, "A. Distancia a Recorrer / Ptos", 115, 412, 6.5, { bold: true, align: "center" });
  drawText(commands, "B. Clima / Ptos", 306, 412, 6.5, { bold: true, align: "center" });
  drawText(commands, "C. Vehículos y personas / Ptos", 496, 412, 6.5, { bold: true, align: "center" });

  // Contenido Col A
  drawText(commands, "Menos de 50 Km", 24, 398, 6.5); drawText(commands, "1", 200, 398, 6.5, { bold: true, align: "right" });
  drawText(commands, "Menos de 100 Km", 24, 387, 6.5); drawText(commands, "2", 200, 387, 6.5, { bold: true, align: "right" });
  drawText(commands, "Menos de 200 Km", 24, 376, 6.5); drawText(commands, "5", 200, 376, 6.5, { bold: true, align: "right" });
  drawText(commands, "Más de 200 Km", 24, 365, 6.5); drawText(commands, "8", 200, 365, 6.5, { bold: true, align: "right" });

  // Contenido Col B
  drawText(commands, "Seco / Cond. normales", 215, 398, 6.5); drawText(commands, "2", 390, 398, 6.5, { bold: true, align: "right" });
  drawText(commands, "Lluvia suave", 215, 387, 6.5); drawText(commands, "4", 390, 387, 6.5, { bold: true, align: "right" });
  drawText(commands, "Lluvia fuerte/niebla", 215, 376, 6.5); drawText(commands, "8", 390, 376, 6.5, { bold: true, align: "right" });
  drawText(commands, "Nieve", 215, 365, 6.5); drawText(commands, "10", 390, 365, 6.5, { bold: true, align: "right" });

  // Contenido Col C
  drawText(commands, "2+ Vehi. 2+ pers.", 406, 398, 6.5); drawText(commands, "1", 582, 398, 6.5, { bold: true, align: "right" });
  drawText(commands, "2+ Vehi. 1+ pers.", 406, 387, 6.5); drawText(commands, "2", 582, 387, 6.5, { bold: true, align: "right" });
  drawText(commands, "1Vehi. 2+ pers.", 406, 376, 6.5); drawText(commands, "3", 582, 376, 6.5, { bold: true, align: "right" });
  drawText(commands, "1Vehi. 1 pers.", 406, 365, 6.5); drawText(commands, "6", 582, 365, 6.5, { bold: true, align: "right" });

  // --- FILA 2 (y: 317 a 369): D, E, F ---
  // Subheaders
  line(commands, MARGIN, 357, PAGE_WIDTH - MARGIN, 357, 0.6);
  drawText(commands, "D. Condiciones de la Vía / Ptos", 115, 360, 6.5, { bold: true, align: "center" });
  drawText(commands, "E. Comunicaciones / Ptos", 306, 360, 6.5, { bold: true, align: "center" });
  drawText(commands, "F. Hrs. trabajadas + Viaje / Ptos", 496, 360, 6.5, { bold: true, align: "center" });

  // Contenido Col D
  drawText(commands, "Pavimentada", 24, 345, 6.5); drawText(commands, "1", 200, 345, 6.5, { bold: true, align: "right" });
  drawText(commands, "Mixta (<50% No Pav.)", 24, 333, 6.5); drawText(commands, "2", 200, 333, 6.5, { bold: true, align: "right" });
  drawText(commands, "No Pavimentada", 24, 321, 6.5); drawText(commands, "4", 200, 321, 6.5, { bold: true, align: "right" });

  // Contenido Col E
  drawText(commands, "Teléfono celular", 215, 345, 6.5); drawText(commands, "0", 390, 345, 6.5, { bold: true, align: "right" });
  drawText(commands, "Sin com. y caravana", 215, 333, 6.5); drawText(commands, "2", 390, 333, 6.5, { bold: true, align: "right" });
  drawText(commands, "Sin com. sin caravana", 215, 321, 6.5); drawText(commands, "4", 390, 321, 6.5, { bold: true, align: "right" });

  // Contenido Col F
  drawText(commands, "Hrs. trab. + Viaje =<12", 406, 345, 6.5); drawText(commands, "1", 582, 345, 6.5, { bold: true, align: "right" });
  drawText(commands, "Hrs. trab. + Viaje =<14", 406, 333, 6.5); drawText(commands, "3", 582, 333, 6.5, { bold: true, align: "right" });
  drawText(commands, "Hrs. Trab. + Viaje =<16", 406, 321, 6.5); drawText(commands, "6", 582, 321, 6.5, { bold: true, align: "right" });

  // --- FILA 3 (y: 265 a 317): G, Alertas/Notas, EVALUACIÓN DEL VIAJE ---
  line(commands, MARGIN, 305, 210.6, 305, 0.6);
  line(commands, 401.3, 305, PAGE_WIDTH - MARGIN, 305, 0.6);

  // Col 1: G. Hora del Traslado / Ptos
  drawText(commands, "G. Hora del Traslado / Ptos", 115, 308, 6.5, { bold: true, align: "center" });
  drawText(commands, "Día (06:00 a 18:00 h)", 24, 292, 6.5); drawText(commands, "1", 200, 292, 6.5, { bold: true, align: "right" });
  drawText(commands, "Noche (18:00 a 06:00 h)", 24, 277, 6.5); drawText(commands, "8", 200, 277, 6.5, { bold: true, align: "right" });

  // Col 2: Advertencias de Jornada y Nocturno
  drawText(commands, "Horas trabajo + Viaje > 16h = NO CONDUCIR", 306, 304, 6.5, { bold: true, align: "center" });
  drawText(commands, "Manejo Nocturno (>18h) requiere Aprobación GCO/QHSE.", 306, 292, 6, { align: "center" });
  drawText(commands, `Obs: ${data.observaciones || "Sin notas."}`, 215, 278, 6);

  // Col 3: EVALUACIÓN DEL VIAJE
  drawText(commands, "EVALUACIÓN DEL VIAJE", 496, 308, 6.5, { bold: true, align: "center" });
  line(commands, 460, 265, 460, 305, 0.6);

  // Desglose de puntos (izquierda de Col 3)
  drawText(commands, `A: ${ptsA}`, 410, 300, 5.5);
  drawText(commands, `B: ${ptsB}`, 410, 294, 5.5);
  drawText(commands, `C: ${ptsC}`, 410, 288, 5.5);
  drawText(commands, `D: ${ptsD}`, 410, 282, 5.5);
  drawText(commands, `E: ${ptsE}`, 410, 276, 5.5);
  drawText(commands, `F: ${ptsF}`, 410, 270, 5.5);
  drawText(commands, `G: ${ptsG}`, 410, 264, 5.5);

  // Recuadro Puntaje Total (derecha de Col 3)
  drawText(commands, `${puntajeTotal} pts`, 525, 286, 9.5, { bold: true, align: "center" });
  drawText(commands, `RIESGO ${nivelRiesgo}`, 525, 274, 6.8, { bold: true, fill: "#64748b", align: "center" });

  // 7. NOTA Y CLASIFICACIÓN DE RIESGO (y: 215 a 265)
  drawText(commands, "NOTA: DE ACUERDO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN", PAGE_WIDTH / 2, 254, 6.2, { bold: true, align: "center" });

  rect(commands, MARGIN, 218, CONTENT_WIDTH, 32, { stroke: "#000000", lineWidth: 0.8 });
  line(commands, 210.6, 218, 210.6, 250, 0.6);
  line(commands, 401.3, 218, 401.3, 250, 0.6);

  drawText(commands, "RIESGO BAJO (0 A 15 PUNTOS)", 115, 236, 6.8, { bold: true, align: "center" });
  drawText(commands, "AUTORIZA SUPERVISOR DIRECTO Y QHSE", 115, 226, 6.5, { bold: true, align: "center" });

  drawText(commands, "RIESGO MEDIO (16 A 22 PUNTOS)", 306, 236, 6.8, { bold: true, align: "center" });
  drawText(commands, "COORDINACIONES DE AREA", 306, 226, 6.5, { bold: true, align: "center" });

  drawText(commands, "RIESGO ALTO (> 23 PUNTOS)", 496, 236, 6.8, { bold: true, align: "center" });
  drawText(commands, "AUTORIZA GERENCIA GENERAL", 496, 226, 6.5, { bold: true, align: "center" });

  // 8. SECCIÓN DE FIRMAS (y: 35 a 218, h: 183)
  // Nivel 1: Conductor (centrado en la página)
  if (imageReferences.firmaCond) {
    drawImage(commands, imageReferences.firmaCond.name, imageReferences.firmaCond.image, 216, 145, 180, 45);
  }
  line(commands, 196, 143, 416, 143, 0.8);
  drawText(commands, truncate(conductorNombre, 40), 306, 131, 7.5, { bold: true, align: "center" });
  drawText(commands, "CONDUCTOR", 306, 119, 7, { bold: true, align: "center" });

  // Nivel 2: Autoridades (3 columnas según nivel de riesgo)
  const showSigQHSE = Boolean(imageReferences.firmaSup) && (nivelRiesgo === "BAJO" || !data.nivel_riesgo);
  const showSigCoordinador = Boolean(imageReferences.firmaSup) && nivelRiesgo === "MEDIO";
  const showSigGerente = Boolean(imageReferences.firmaSup) && nivelRiesgo === "ALTO";

  // Col 1: Supervisor Directo / QHSE (x: 20 a 210.6, center at 115)
  if (showSigQHSE && imageReferences.firmaSup) {
    drawImage(commands, imageReferences.firmaSup.name, imageReferences.firmaSup.image, 45, 70, 140, 38);
  }
  line(commands, 35, 68, 195, 68, 0.8);
  drawText(commands, showSigQHSE ? truncate(supervisorNombre, 35) : "NOMBRE Y FIRMA", 115, 56, 7.5, { bold: true, align: "center" });
  drawText(commands, "SUPERVISOR DIRECTO / QHSE", 115, 46, 6.5, { bold: true, align: "center" });

  // Col 2: Autoridad de Área / Coordinación (x: 210.6 a 401.3, center at 306)
  if (showSigCoordinador && imageReferences.firmaSup) {
    drawImage(commands, imageReferences.firmaSup.name, imageReferences.firmaSup.image, 236, 70, 140, 38);
  }
  line(commands, 216, 68, 396, 68, 0.8);
  drawText(commands, showSigCoordinador ? truncate(supervisorNombre, 35) : "NOMBRE Y FIRMA", 306, 56, 6.5, { bold: true, align: "center" });
  drawText(commands, "AUTORIDAD DE ÁREA / COORDINACIÓN", 306, 46, 6.2, { bold: true, align: "center" });

  // Col 3: Gerente de Área (x: 401.3 a 592, center at 496)
  if (showSigGerente && imageReferences.firmaSup) {
    drawImage(commands, imageReferences.firmaSup.name, imageReferences.firmaSup.image, 426, 70, 140, 38);
  }
  line(commands, 416, 68, 576, 68, 0.8);
  drawText(commands, showSigGerente ? truncate(supervisorNombre, 35) : "NOMBRE Y FIRMA", 496, 56, 6.5, { bold: true, align: "center" });
  drawText(commands, "GERENTE DE ÁREA", 496, 46, 6.5, { bold: true, align: "center" });

  // 9. PIE DE PÁGINA (NOTA INSTITUCIONAL)
  line(commands, MARGIN, 35, PAGE_WIDTH - MARGIN, 35, 0.8);
  drawText(
    commands,
    "NOTA: Un Gerenciamiento de Viajes debe ser preparado para todos los viajes: Superiores a 50 Km, en áreas remotas o bajo condiciones adversas, hacia o desde locaciones en campo con el cliente.",
    PAGE_WIDTH / 2,
    25,
    6.2,
    { align: "center", fill: "#991b1b" }
  );

  const contentStream = Buffer.from(commands.join("\n"), "latin1");
  const contentId = addObject(streamObject("", contentStream));

  const xobjectDict = Object.keys(imageReferences).length > 0
    ? `/XObject << ${Object.values(imageReferences).map((ref) => `/${ref.name} ${ref.id} 0 R`).join(" ")} >>`
    : "";

  const pageId = addObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> ${xobjectDict} >> /Contents ${contentId} 0 R >>`
  );
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
  for (let id = 1; id < objects.length; id += 1) {
    trailer += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  pdf = Buffer.concat([pdf, Buffer.from(trailer, "latin1")]);

  const cleanFolio = String(folio).replace(/[/\\?%*:|"<>]/g, "-");
  return {
    nombre: `gerenciamiento_${cleanFolio}_${Date.now()}.pdf`,
    buffer: pdf
  };
}
