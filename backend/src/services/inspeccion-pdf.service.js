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
  pasajero: new URL("../assets/inspection-diagrams/pasajero.png", import.meta.url)
};

function pdfEscape(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function truncate(value, length) {
  const text = String(value ?? "").trim() || "N/A";
  return text.length > length ? `${text.slice(0, Math.max(1, length - 3))}...` : text;
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

function readPng(buffer) {
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

  // Los diagramas con transparencia se aplanan sobre blanco porque el PDF
  // incrusta las imágenes como RGB, sin canal alfa.
  const rgbPixels = Buffer.alloc(width * height * 3);
  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
    const alpha = pixels[source + 3] / 255;
    rgbPixels[target] = Math.round(pixels[source] * alpha + 255 * (1 - alpha));
    rgbPixels[target + 1] = Math.round(pixels[source + 1] * alpha + 255 * (1 - alpha));
    rgbPixels[target + 2] = Math.round(pixels[source + 2] * alpha + 255 * (1 - alpha));
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
  const { bold = false, fill = "#173f51", align = "left" } = options;
  const safeText = pdfEscape(text);
  const approximateWidth = String(text).length * size * (bold ? 0.57 : 0.5);
  const alignedX = align === "right" ? x - approximateWidth : align === "center" ? x - approximateWidth / 2 : x;
  commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color(fill)} rg 1 0 0 1 ${alignedX.toFixed(2)} ${y.toFixed(2)} Tm (${safeText}) Tj ET`);
}

function line(commands, x1, y1, x2, y2, width = 0.55, stroke = "#466572") {
  commands.push(`${width} w ${color(stroke)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
}

function rect(commands, x, y, width, height, options = {}) {
  const { fill, stroke = "#466572", lineWidth = 0.55 } = options;
  const fillCommand = fill ? `${color(fill)} rg ` : "";
  const strokeCommand = stroke ? `${color(stroke)} RG ${lineWidth} w ` : "";
  commands.push(`${fillCommand}${strokeCommand}${x} ${y} ${width} ${height} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
}

function circle(commands, x, y, radius, stroke = "#d12d2d") {
  const control = radius * 0.5522847498;
  commands.push(`q ${color(stroke)} RG 1.6 w ${x + radius} ${y} m ${x + radius} ${y + control} ${x + control} ${y + radius} ${x} ${y + radius} c ${x - control} ${y + radius} ${x - radius} ${y + control} ${x - radius} ${y} c ${x - radius} ${y - control} ${x - control} ${y - radius} ${x} ${y - radius} c ${x + control} ${y - radius} ${x + radius} ${y - control} ${x + radius} ${y} c S Q`);
}

function addLabeledField(commands, label, value, x, y, width) {
  rect(commands, x, y, width, 14, { stroke: "#6b818a" });
  drawText(commands, label, x + 3, y + 9, 5.8, { bold: true, fill: "#365862" });
  drawText(commands, truncate(value, Math.floor(width / 3.7)), x + 3, y + 2.3, 6.2, { fill: "#173f51" });
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
    drawText(commands, String(index + 1), markerX - 1.7, markerY - 1.7, 4.2, { bold: true, fill: "#d12d2d" });
  });
}

export function buildInspectionPdf(data) {
  const diagrams = Object.fromEntries(Object.entries(diagramFiles).map(([view, url]) => [view, readPng(readFileSync(fileURLToPath(url)))]));
  const signature = imageFromDataUrl(data.firma_conductor);
  const objects = [null];
  const addObject = (value) => { objects.push(value); return objects.length - 1; };
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";
  const regularFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFont = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const imageEntries = Object.entries(diagrams);
  if (signature) imageEntries.push(["firma", signature]);
  const imageReferences = Object.fromEntries(imageEntries.map(([name, image], index) => [name, { name: `Im${index + 1}`, image, id: addObject(streamObject(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, image.data)) }]));

  const commands = [];
  const dark = "#173f51";
  const border = "#466572";
  const teal = "#3b6975";
  const red = "#d98176";
  rect(commands, MARGIN, 752, 540, 28, { stroke: border, lineWidth: 0.8 });
  rect(commands, MARGIN, 752, 112, 28, { fill: "#f7fafb", stroke: border, lineWidth: 0.8 });
  drawText(commands, "Itzamma", 59, 765, 12, { bold: true, fill: teal });
  drawText(commands, "OIL & GAS", 64, 756, 5.4, { bold: true, fill: teal });
  drawText(commands, "Servicios Industriales y de", 288, 768, 12.6, { bold: true, fill: teal, align: "center" });
  drawText(commands, "Ingeniería Itzamma", 288, 755, 12.6, { bold: true, fill: teal, align: "center" });
  const documentNumber = `SII-MX-${new Date(data.aprobado_en || Date.now()).getFullYear()}-LOG-${String(data.id_viajes || "").padStart(3, "0")}`;
  [["Emisión", new Date(data.aprobado_en || Date.now()).toLocaleDateString("es-MX")], ["Página", "Página 1 de 1"], ["Versión", "2.2"], ["Área Responsable", "Logística"], ["No. Documento", documentNumber]].forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = 432 + col * 48;
    const width = 48;
    const y = 766 - row * 13;
    rect(commands, x, y, width, 13, { stroke: border });
    drawText(commands, label, x + 2, y + 8.3, 4.5, { bold: true, fill: dark });
    drawText(commands, truncate(value, 13), x + 2, y + 2.4, 4.5, { fill: dark });
  });
  rect(commands, MARGIN, 736, 540, 11, { fill: "#edf4f6", stroke: border });
  drawText(commands, "INSPECCIÓN VEHICULAR", PAGE_WIDTH / 2, 738.4, 9.2, { bold: true, fill: dark, align: "center" });

  const fields = [
    ["Tipo de vehículo", data.tipo_vehiculo], ["Nombre del conductor", data.conductor], ["Póliza y vigencia", `${data.numero_poliza || "N/A"} ${data.seguro_vencimiento || ""}`], ["No. folio", data.folio],
    ["No. de unidad", data.numero_economico], ["No. licencia", data.licencia_numero], ["No. serie", data.numero_serie], ["Kilometraje", `${data.kilometraje_inicial || "N/A"} km`],
    ["Fecha", new Date(data.aprobado_en || Date.now()).toLocaleDateString("es-MX")], ["Hora", new Date(data.aprobado_en || Date.now()).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })], ["Licencia / vigencia", `${data.tipo_licencia || "N/A"} / ${data.licencia_vigente ? "Vigente" : "No vigente"}`], ["Placas", data.placas],
    ["Asignación", data.tipo_asignacion], ["Combustible", data.combustible], ["Aprobación", data.estado], ["Autorizó", data.aprobador || "Pendiente"]
  ];
  fields.forEach(([label, value], index) => addLabeledField(commands, label, value, MARGIN + (index % 4) * 135, 668 - Math.floor(index / 4) * 16, 135));
  drawText(commands, "ENCIERRE CUALQUIER DAÑO OBSERVADO EN UN CÍRCULO, EN LA UBICACIÓN CORRESPONDIENTE DEL DIAGRAMA.", PAGE_WIDTH / 2, 599, 6.8, { bold: true, fill: "#c46b6d", align: "center" });
  rect(commands, MARGIN, 397, 540, 195, { stroke: border, lineWidth: 0.8 });
  const collage = [
    ["frontal", 49, 496, 115, 82], ["conductor", 185, 496, 375, 82],
    ["trasera", 49, 408, 115, 82], ["pasajero", 185, 408, 375, 82]
  ];
  collage.forEach(([view, x, y, width, height]) => {
    const entry = imageReferences[view];
    drawImage(commands, entry.name, entry.image, x, y, width, height, data.danos?.[view] || []);
    drawText(commands, view.toUpperCase(), x + width / 2, y + height - 7, 6.2, { bold: true, fill: dark, align: "center" });
  });

  rect(commands, MARGIN, 382, 540, 10, { fill: red, stroke: border });
  drawText(commands, "Marque cada casilla sólo con una letra: Bueno (B), Regular (R), Malo (M) y No Aplica (N/A).", PAGE_WIDTH / 2, 384.5, 6.3, { bold: true, fill: dark, align: "center" });
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
  const tableTop = 370;
  const rowHeight = 8;
  checklistColumns.forEach((column, columnIndex) => {
    const x = MARGIN + columnIndex * 180;
    rect(commands, x, tableTop, 180, 10, { fill: "#edf4f6", stroke: border });
    drawText(commands, column.title, x + 90, tableTop + 3.2, 5.5, { bold: true, fill: dark, align: "center" });
    let y = tableTop;
    column.sections.forEach((section) => {
      y -= rowHeight;
      rect(commands, x, y, 180, rowHeight, { fill: "#f7fafb", stroke: border });
      drawText(commands, section.title, x + 90, y + 2.1, 4.8, { bold: true, fill: dark, align: "center" });
      section.items.forEach((item) => {
        y -= rowHeight;
        rect(commands, x, y, 180, rowHeight, { stroke: border });
        line(commands, x + 17, y, x + 17, y + rowHeight, 0.4, border);
        drawText(commands, truncate(data.checklist?.[item] || "—", 3), x + 4, y + 1.7, 4.9, { bold: true, fill: dark });
        drawText(commands, truncate(item, 38), x + 20, y + 1.7, 4.9, { fill: dark });
      });
    });
  });
  const commentsTop = 184;
  rect(commands, MARGIN, commentsTop, 540, 10, { fill: red, stroke: border });
  drawText(commands, "COMENTARIOS DEL CONDUCTOR", PAGE_WIDTH / 2, commentsTop + 3.1, 5.8, { bold: true, fill: dark, align: "center" });
  rect(commands, MARGIN, 132, 540, 52, { stroke: border });
  [145, 158, 171].forEach((y) => line(commands, MARGIN, y, 576, y, 0.4, border));
  const comment = truncate(data.observaciones_conductor || "Sin observaciones.", 150);
  drawText(commands, comment, 42, 174, 6.2, { fill: dark });
  drawText(commands, "Conductor:", 150, 100, 6.3, { bold: true, fill: dark });
  drawText(commands, "Autorizó (Gerencia / Coordinación):", 430, 100, 6.3, { bold: true, fill: dark, align: "center" });
  line(commands, 54, 74, 282, 74, 0.7, border);
  line(commands, 330, 74, 558, 74, 0.7, border);
  if (signature && imageReferences.firma) drawImage(commands, imageReferences.firma.name, signature, 58, 76, 220, 20);
  drawText(commands, "Nombre y firma", 168, 65, 5.3, { bold: true, fill: dark, align: "center" });
  drawText(commands, "Nombre y firma", 444, 65, 5.3, { bold: true, fill: dark, align: "center" });
  drawText(commands, "Fecha:", 146, 48, 5.8, { bold: true, fill: dark });
  drawText(commands, "Fecha:", 422, 48, 5.8, { bold: true, fill: dark });

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
