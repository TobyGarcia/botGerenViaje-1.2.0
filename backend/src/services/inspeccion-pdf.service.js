import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;

const diagramFiles = {
  frontal: new URL("../assets/inspection-diagrams/frontal.png", import.meta.url),
  trasera: new URL("../assets/inspection-diagrams/trasera.png", import.meta.url),
  conductor: new URL("../assets/inspection-diagrams/conductor.png", import.meta.url),
  pasajero: new URL("../assets/inspection-diagrams/pasajero.png", import.meta.url),
  logoAquario: new URL("../assets/aquario-logo.png", import.meta.url)
};

function pdfEscape(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function truncate(value, length) {
  const text = String(value ?? "").trim() || "N/A";
  return text.length > length ? `${text.slice(0, Math.max(1, length - 3))}...` : text;
}

function formatShortDate(val) {
  if (!val) return "";
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

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function readPng(buffer, bgRgb = [255, 255, 255]) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("El diagrama no es una imagen PNG válida.");
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
    throw new Error("El diagrama PNG debe usar RGB o RGBA de 8 bits sin entrelazado.");
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

  // Los diagramas con transparencia se aplanan sobre el color bgRgb especificado
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
  return readPng(Buffer.from(dataUrl.split(",")[1], "base64"));
}

function streamObject(dictionary, data) {
  return Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream", "latin1")]);
}

function drawText(commands, text, x, y, size = 7, options = {}) {
  const { bold = false, fill = "#1b516f", align = "left" } = options;
  const safeText = pdfEscape(text);
  const approximateWidth = String(text).length * size * (bold ? 0.57 : 0.5);
  const alignedX = align === "right" ? x - approximateWidth : align === "center" ? x - approximateWidth / 2 : x;
  commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color(fill)} rg 1 0 0 1 ${alignedX.toFixed(2)} ${y.toFixed(2)} Tm (${safeText}) Tj ET`);
}

function line(commands, x1, y1, x2, y2, width = 0.55, stroke = "#b6d5e5") {
  commands.push(`${width} w ${color(stroke)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
}

function rect(commands, x, y, width, height, options = {}) {
  const { fill, stroke = "#b6d5e5", lineWidth = 0.55 } = options;
  const fillCommand = fill ? `${color(fill)} rg ` : "";
  const strokeCommand = stroke ? `${color(stroke)} RG ${lineWidth} w ` : "";
  commands.push(`${fillCommand}${strokeCommand}${x} ${y} ${width} ${height} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
}

function circle(commands, x, y, radius, stroke = "#d93838") {
  const control = radius * 0.5522847498;
  commands.push(`q ${color(stroke)} RG 1.6 w ${x + radius} ${y} m ${x + radius} ${y + control} ${x + control} ${y + radius} ${x} ${y + radius} c ${x - control} ${y + radius} ${x - radius} ${y + control} ${x - radius} ${y} c ${x - radius} ${y - control} ${x - control} ${y - radius} ${x} ${y - radius} c ${x + control} ${y - radius} ${x + radius} ${y - control} ${x + radius} ${y} c S Q`);
}

function addLabeledField(commands, label, value, x, y, width) {
  rect(commands, x, y, width, 14, { fill: "#ffffff", stroke: "#b6d5e5" });
  drawText(commands, label, x + 3, y + 8.8, 5.5, { bold: true, fill: "#1b516f" });
  drawText(commands, truncate(value, Math.floor(width / 3.7)), x + 3, y + 2.2, 6.2, { fill: "#0d4661" });
}

function drawImage(commands, name, image, x, y, width, height, points = []) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const drawnX = x + (width - drawnWidth) / 2;
  const drawnY = y + (height - drawnHeight) / 2;
  commands.push(`q ${drawnWidth.toFixed(2)} 0 0 ${drawnHeight.toFixed(2)} ${drawnX.toFixed(2)} ${drawnY.toFixed(2)} cm /${name} Do Q`);
  points.forEach((point, index) => {
    const markerX = drawnX + (Number(point.x) / 100) * drawnWidth;
    const markerY = drawnY + (1 - Number(point.y) / 100) * drawnHeight;
    circle(commands, markerX, markerY, 5.5);
    drawText(commands, String(index + 1), markerX - 1.7, markerY - 1.7, 4.2, { bold: true, fill: "#d93838" });
  });
}

export function buildInspectionPdf(data) {
  const diagrams = Object.fromEntries(
    Object.entries(diagramFiles).map(([view, url]) => {
      try {
        // Aplanar el logo AQUARIO sobre fondo azul marino (#1b516f -> RGB 27, 81, 111)
        const bg = view === "logoAquario" ? [27, 81, 111] : [255, 255, 255];
        return [view, readPng(readFileSync(fileURLToPath(url)), bg)];
      } catch { return [view, null]; }
    }).filter(([, img]) => img !== null)
  );

  const signature = imageFromDataUrl(data.firma_conductor);
  const supervisorSignature = imageFromDataUrl(data.firma_supervisor);
  const objects = [null];
  const addObject = (value) => { objects.push(value); return objects.length - 1; };
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";
  const regularFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const imageEntries = Object.entries(diagrams);
  if (signature) imageEntries.push(["firma", signature]);
  if (supervisorSignature) imageEntries.push(["firmaSupervisor", supervisorSignature]);
  const imageReferences = Object.fromEntries(imageEntries.map(([name, image], index) => [name, { name: `Im${index + 1}`, image, id: addObject(streamObject(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, image.data)) }]));

  const commands = [];

  // Paleta de colores oficial de AQUARIO (coincide con panel-admin)
  const darkNavy = "#1b516f";
  const brandBlue = "#2e81ab";
  const border = "#b6d5e5";
  const lightCyan = "#e8f8fe";
  const textDark = "#0d4661";
  const textWhite = "#ffffff";

  // CABECERA SUPERIOR (Y: 748 a 780)
  rect(commands, MARGIN, 748, 540, 32, { stroke: border, lineWidth: 0.8 });

  // Cuadro Izquierdo - Logo AQUARIO
  rect(commands, MARGIN, 748, 120, 32, { fill: darkNavy, stroke: border, lineWidth: 0.8 });
  if (imageReferences.logoAquario) {
    drawImage(commands, imageReferences.logoAquario.name, imageReferences.logoAquario.image, MARGIN + 4, 750, 112, 28);
  } else {
    drawText(commands, "AQUARIO", 96, 762, 13.5, { bold: true, fill: textWhite, align: "center" });
    drawText(commands, "SERVICIOS INDUSTRIALES", 96, 752, 5.2, { bold: true, fill: "#51c8f3", align: "center" });
  }

  // Cuadro Central - Nombre de Empresa
  rect(commands, MARGIN + 120, 748, 276, 32, { fill: "#ffffff", stroke: border, lineWidth: 0.8 });
  drawText(commands, "AQUARIO", 294, 767, 13, { bold: true, fill: darkNavy, align: "center" });
  drawText(commands, "Servicios Industriales", 294, 754, 9.5, { bold: true, fill: brandBlue, align: "center" });

  // Cuadro Derecho - Datos del Documento
  const documentNumber = `SII-MX-${new Date(data.aprobado_en || Date.now()).getFullYear()}-LOG-${String(data.id_viajes || "").padStart(3, "0")}`;
  const fechaAprobacion = formatShortDate(data.aprobado_en || Date.now());

  [["Emisión", fechaAprobacion], ["Página", "Página 1 de 1"], ["Versión", "2.2"], ["Área Responsable", "Logística"], ["No. Documento", documentNumber]].forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = 432 + col * 48;
    const width = 48;
    const y = 765 - row * 14;
    rect(commands, x, y, width, 14, { fill: lightCyan, stroke: border });
    drawText(commands, label, x + 2, y + 8.5, 4.4, { bold: true, fill: darkNavy });
    drawText(commands, truncate(value, 13), x + 2, y + 2.4, 4.4, { fill: textDark });
  });

  // SUB-BARRA DE TÍTULO "INSPECCIÓN VEHICULAR" (Y: 734 a 746)
  rect(commands, MARGIN, 734, 540, 12, { fill: darkNavy, stroke: border });
  drawText(commands, "INSPECCIÓN VEHICULAR", PAGE_WIDTH / 2, 736.5, 9.2, { bold: true, fill: textWhite, align: "center" });

  // TABLA DE METADATOS (Y: 676 a 732)
  const polizaVigenciaText = `${data.numero_poliza || "N/A"}${data.seguro_vencimiento ? ` - ${formatShortDate(data.seguro_vencimiento)}` : ""}`;
  const licenciaVigenciaText = `${data.tipo_licencia || "N/A"} / ${data.licencia_vigente ? "Vigente" : "No vigente"}`;

  const fields = [
    ["Tipo de vehículo", data.tipo_vehiculo], ["Nombre del conductor", data.conductor], ["Póliza y vigencia", polizaVigenciaText], ["No. folio", data.folio],
    ["No. de unidad", data.numero_economico], ["No. licencia", data.licencia_numero], ["No. serie", data.numero_serie], ["Kilometraje", `${data.kilometraje_inicial || "N/A"} km`],
    ["Fecha", formatShortDate(data.aprobado_en || data.creado_en || Date.now())], ["Hora", new Date(data.aprobado_en || Date.now()).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })], ["Licencia / vigencia", licenciaVigenciaText], ["Placas", data.placas],
    ["Asignación", data.tipo_asignacion], ["Combustible", data.combustible], ["Aprobación", data.estado], ["Autorizó", data.aprobador || "Pendiente"]
  ];

  fields.forEach(([label, value], index) => addLabeledField(commands, label, value, MARGIN + (index % 4) * 135, 716 - Math.floor(index / 4) * 14.5, 135));

  // BANNER DE INSTRUCCIONES DE DAÑOS (Y: 648 a 658)
  rect(commands, MARGIN, 648, 540, 11, { fill: darkNavy, stroke: border });
  drawText(commands, "ENCIERRE CUALQUIER DAÑO OBSERVADO EN UN CÍRCULO, EN LA UBICACIÓN CORRESPONDIENTE DEL DIAGRAMA.", PAGE_WIDTH / 2, 650.5, 6.6, { bold: true, fill: textWhite, align: "center" });

  // DIAGRAMAS DE VEHÍCULO (Y: 454 a 646)
  rect(commands, MARGIN, 454, 540, 192, { fill: "#ffffff", stroke: border, lineWidth: 0.8 });
  const collage = [
    ["frontal", 49, 550, 115, 82], ["conductor", 185, 550, 375, 82],
    ["trasera", 49, 460, 115, 82], ["pasajero", 185, 460, 375, 82]
  ];
  collage.forEach(([view, x, y, width, height]) => {
    const entry = imageReferences[view];
    if (entry) {
      drawImage(commands, entry.name, entry.image, x, y, width, height, data.danos?.[view] || []);
    }
    drawText(commands, view.toUpperCase(), x + width / 2, y + height + 2, 6.2, { bold: true, fill: darkNavy, align: "center" });
  });

  // BANNER INSTRUCTIVO CHECKLIST (Y: 440 a 450)
  rect(commands, MARGIN, 440, 540, 10, { fill: brandBlue, stroke: border });
  drawText(commands, "Marque cada casilla sólo con una letra: Bueno (B), Regular (R), Malo (M) y No Aplica (N/A).", PAGE_WIDTH / 2, 442.5, 6.3, { bold: true, fill: textWhite, align: "center" });

  // TABLA DE CHECKLIST (Y: 283 a 430) - rowHeight de 7pt para espacio perfecto
  const checklistColumns = [
    {
      title: "DOCUMENTACIÓN Y EQUIPO",
      sections: [
        { title: "DOCUMENTACIÓN DE LA UNIDAD", items: ["Tarjeta de circulación vigente", "Póliza de seguro vigente", "Verificación vigente", "Engomado de placas", "Placa delantera", "Placa trasera", "Plan de respuesta de emergencia", "Bitácora vehicular"] },
        { title: "EXTINTOR", items: ["Plan de seguridad", "Carga vigente", "Etiqueta de inspección", "Soporte para extintor"] },
        { title: "KIT BÁSICO DE CARRETERA", items: ["Elevador manual (gato)", "Linterna", "Triángulos reflectores (2)", "Botiquín", "Cable pasa-corriente"] }
      ]
    },
    {
      title: "CONDICIONES GENERALES",
      sections: [
        { title: "NEUMÁTICOS", items: ["Neumático delantero derecho", "Neumático delantero izquierdo", "Neumático trasero derecho", "Neumático trasero izquierdo", "Presión de neumáticos"] },
        { title: "PARABRISAS Y ESPEJOS", items: ["Parabrisas frontal", "Vidrios", "Espejo lateral derecho", "Espejo lateral izquierdo", "Retrovisor"] },
        { title: "LUCES", items: ["Delanteras", "Intermitentes", "Freno", "Reversa", "Faros de niebla"] }
      ]
    },
    {
      title: "VERIFICAR SÓLO LO QUE APLIQUE",
      sections: [
        { title: "REVISIÓN MECÁNICA", items: ["Aceite de motor", "Líquido refrigerante", "Fluido de transmisión", "Líquido de frenos", "Freno de mano", "Bandas de motor", "Líquido de dirección", "Batería", "Limpiador de vidrios", "Cinturones de seguridad", "Llave de cruz", "Monitor de velocidad", "Neumático de repuesto"] },
        { title: "LIMPIEZA", items: ["Interior", "Exterior"] }
      ]
    }
  ];
  const tableTop = 430;
  const rowHeight = 7;
  checklistColumns.forEach((column, columnIndex) => {
    const x = MARGIN + columnIndex * 180;
    rect(commands, x, tableTop, 180, 9, { fill: darkNavy, stroke: border });
    drawText(commands, column.title, x + 90, tableTop + 2.6, 5.3, { bold: true, fill: textWhite, align: "center" });
    let y = tableTop;
    column.sections.forEach((section) => {
      y -= rowHeight;
      rect(commands, x, y, 180, rowHeight, { fill: lightCyan, stroke: border });
      drawText(commands, section.title, x + 90, y + 1.8, 4.6, { bold: true, fill: darkNavy, align: "center" });
      section.items.forEach((item) => {
        y -= rowHeight;
        rect(commands, x, y, 180, rowHeight, { stroke: border });
        line(commands, x + 16, y, x + 16, y + rowHeight, 0.4, border);
        drawText(commands, truncate(data.checklist?.[item] || "—", 3), x + 3, y + 1.5, 4.7, { bold: true, fill: darkNavy });
        drawText(commands, truncate(item, 38), x + 19, y + 1.5, 4.7, { fill: textDark });
      });
    });
  });

  // SECCIÓN COMENTARIOS Y FIRMAS (Y: 36 a 268)
  const commentsTop = 268;
  rect(commands, MARGIN, commentsTop, 540, 10, { fill: brandBlue, stroke: border });
  drawText(commands, "COMENTARIOS DEL CONDUCTOR", PAGE_WIDTH / 2, commentsTop + 3.1, 5.8, { bold: true, fill: textWhite, align: "center" });

  rect(commands, MARGIN, 208, 540, 50, { fill: "#ffffff", stroke: border });
  [221, 234, 247].forEach((y) => line(commands, MARGIN, y, 576, y, 0.4, border));
  const comment = truncate(data.observaciones_conductor || "Sin observaciones.", 150);
  drawText(commands, comment, 42, 250, 6.2, { fill: textDark });

  // FIRMAS Y AUTORIZACIÓN
  drawText(commands, "Conductor:", 150, 182, 6.3, { bold: true, fill: darkNavy });
  drawText(commands, "Autorizó (Gerencia / Coordinación):", 430, 182, 6.3, { bold: true, fill: darkNavy, align: "center" });
  line(commands, 54, 152, 282, 152, 0.7, border);
  line(commands, 330, 152, 558, 152, 0.7, border);
  if (signature && imageReferences.firma) drawImage(commands, imageReferences.firma.name, signature, 58, 154, 220, 24);
  if (supervisorSignature && imageReferences.firmaSupervisor) drawImage(commands, imageReferences.firmaSupervisor.name, supervisorSignature, 334, 154, 220, 24);

  drawText(commands, truncate(data.conductor, 42), 168, 140, 5.3, { bold: true, fill: darkNavy, align: "center" });
  drawText(commands, truncate(data.aprobador, 42), 444, 140, 5.3, { bold: true, fill: darkNavy, align: "center" });

  drawText(commands, `Fecha: ${formatShortDate(data.creado_en || Date.now())}`, 146, 124, 5.8, { bold: true, fill: darkNavy });
  drawText(commands, `Fecha: ${formatShortDate(data.aprobado_en || Date.now())}`, 422, 124, 5.8, { bold: true, fill: darkNavy });

  const content = Buffer.from(commands.join("\n"), "latin1");
  const contentId = addObject(streamObject("", content));
  const pageId = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> /XObject << ${Object.values(imageReferences).map((reference) => `/${reference.name} ${reference.id} 0 R`).join(" ")} >> >> /Contents ${contentId} 0 R >>`);
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
  return { buffer: Buffer.concat([pdf, Buffer.from(trailer, "latin1")]), nombre: `inspeccion-${data.folio}.pdf` };
}
