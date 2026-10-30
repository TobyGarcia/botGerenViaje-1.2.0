import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = 540;

const logoGvUrl = new URL("../assets/gv-logo-hd.png", import.meta.url);

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

function color(hex) {
  hex = ({ '#0f172a': '#1b516f', '#0284c7': '#2e81ab', '#dc2626': '#1b516f', '#334155': '#1b516f', '#fca5a5': '#b5d8e8', '#cbd5e1': '#b5d8e8', '#94a3b8': '#b5d8e8', '#fff8f8': '#f3fbfe', '#f8fafc': '#ffffff', '#991b1b': '#1b516f', '#b91c1c': '#1b516f' })[hex] || hex;
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

function readJpeg(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("El archivo no es un JPEG válido.");
  }
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      const numComponents = buffer[offset + 9];
      return { width, height, numComponents, data: buffer };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  throw new Error("No se encontraron metadatos de dimensiones JPEG.");
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

function text(commands, x, y, str, options = {}) {
  const { fontSize = 9, isBold = false, textColor = "#000000", align = "left" } = options;
  const fontName = isBold ? "F2" : "F1";
  let finalX = x;
  if (align === "center" || align === "right") {
    const approxWidth = String(str).length * (fontSize * 0.52);
    if (align === "center") finalX = x - approxWidth / 2;
    if (align === "right") finalX = x - approxWidth;
  }

  commands.push(`BT`);
  commands.push(`/${fontName} ${fontSize} Tf`);
  commands.push(`${color(textColor)} rg`);
  commands.push(`${finalX.toFixed(2)} ${y.toFixed(2)} Td`);
  commands.push(`(${pdfEscape(str)}) Tj`);
  commands.push(`ET`);
}

export function generateSiniestroPdf(siniestro) {
  const logoBuffer = readFileSync(logoGvUrl);
  const logoPng = readPng(logoBuffer, [27, 81, 111]);

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const logoImgObjId = addObject(
    streamObject(
      `/Type /XObject /Subtype /Image /Width ${logoPng.width} /Height ${logoPng.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
      logoPng.data
    )
  );

  const photoObjIds = [];
  const photoSizes = [];
  const photosList = Array.isArray(siniestro.fotos) ? siniestro.fotos : [];

  for (const item of photosList) {
    const base64Str = typeof item === "string" ? item : item?.base64;
    if (!base64Str) continue;

    const rawBase64 = base64Str.includes(";base64,") ? base64Str.split(";base64,")[1] : base64Str;
    const imgBuffer = Buffer.from(rawBase64, "base64");

    if (imgBuffer.length < 10) continue;

    if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4e && imgBuffer[3] === 0x47) {
      try {
        const pngBuf = readPng(imgBuffer, [255, 255, 255]);
        const objId = addObject(
          streamObject(
            `/Type /XObject /Subtype /Image /Width ${pngBuf.width} /Height ${pngBuf.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
            pngBuf.data
          )
        );
        photoObjIds.push(objId);
        photoSizes.push({ width: pngBuf.width, height: pngBuf.height });
      } catch (err) {
        console.warn("Fallo al procesar PNG para PDF de siniestro:", err.message);
      }
    } else if (imgBuffer[0] === 0xff && imgBuffer[1] === 0xd8) {
      try {
        const jpgBuf = readJpeg(imgBuffer);
        const colorSpace = jpgBuf.numComponents === 1 ? "/DeviceGray" : "/DeviceRGB";
        const objId = addObject(
          streamObject(
            `/Type /XObject /Subtype /Image /Width ${jpgBuf.width} /Height ${jpgBuf.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode`,
            jpgBuf.data
          )
        );
        photoObjIds.push(objId);
        photoSizes.push({ width: jpgBuf.width, height: jpgBuf.height });
      } catch (err) {
        console.warn("Fallo al procesar JPEG para PDF de siniestro:", err.message);
      }
    }
  }

  const commands = [];

  // Encabezado
  rect(commands, MARGIN, 748, 120, 32, { fill: "#1b516f", stroke: "#b5d8e8" });
  rect(commands, MARGIN + 120, 748, 276, 32, { fill: "#ffffff", stroke: "#b5d8e8" });
  rect(commands, 432, 748, 144, 32, { fill: "#e8f7fc", stroke: "#b5d8e8" });
  const logoWidth = Math.min(108, 28 * logoPng.width / logoPng.height);
  const logoHeight = logoWidth * logoPng.height / logoPng.width;
  commands.push(`q ${logoWidth} 0 0 ${logoHeight} ${MARGIN + (120 - logoWidth) / 2} ${764 - logoHeight / 2} cm /ImLogo Do Q`);

  text(commands, 294, 767, "AQUARIO", { fontSize: 13, isBold: true, textColor: "#1b516f", align: "center" });
  text(commands, 294, 754, "Servicios Industriales", { fontSize: 9.5, isBold: true, textColor: "#2e81ab", align: "center" });
  rect(commands, MARGIN, 730, CONTENT_WIDTH, 14, { fill: "#1b516f", stroke: "#b5d8e8" });
  text(commands, PAGE_WIDTH / 2, 734, "REPORTE DE SINIESTRO E INCIDENTES", { fontSize: 9, isBold: true, textColor: "#ffffff", align: "center" });

  text(commands, 438, 769, truncate(siniestro.folio || "SIN-0000", 27), { fontSize: 6.5, isBold: true, textColor: "#1b516f" });
  const fechaStr = siniestro.creado_en ? new Date(siniestro.creado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : new Date().toLocaleString("es-MX");
  text(commands, 438, 759, fechaStr, { fontSize: 5.8, textColor: "#1b516f" });
  text(commands, 438, 751, "Logística / QHSE · Página 1 de 1", { fontSize: 5, textColor: "#1b516f" });

  let y = PAGE_HEIGHT - 80;

  // 1. Datos del Conductor y Vehículo
  rect(commands, MARGIN, y - 90, CONTENT_WIDTH, 90, { fill: "#f8fafc", stroke: "#cbd5e1" });
  rect(commands, MARGIN, y - 20, CONTENT_WIDTH, 20, { fill: "#0284c7", stroke: "#0284c7" });
  text(commands, MARGIN + 10, y - 14, "INFORMACIÓN DEL CONDUCTOR Y VEHÍCULO INVOLUCRADO", { fontSize: 9.5, isBold: true, textColor: "#ffffff" });

  y -= 34;
  text(commands, MARGIN + 10, y, `Conductor:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 70, y, truncate(siniestro.conductor_nombre || "No registrado", 35), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 300, y, `Teléfono:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 360, y, truncate(siniestro.conductor_telefono || "No registrado", 25), { fontSize: 8.5, textColor: "#0f172a" });

  y -= 16;
  text(commands, MARGIN + 10, y, `Empresa:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 70, y, truncate(siniestro.empresa || "ITZAMNA", 30), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 300, y, `Puesto / Cargo:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 375, y, truncate(siniestro.puesto || "No especificado", 30), { fontSize: 8.5, textColor: "#0f172a" });

  y -= 16;
  text(commands, MARGIN + 10, y, `Vehículo:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 70, y, truncate(siniestro.vehiculo_nombre || "No asignado", 30), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 300, y, `N° Económico:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 375, y, truncate(siniestro.numero_economico || "N/A", 20), { fontSize: 8.5, textColor: "#0f172a" });

  y -= 16;
  text(commands, MARGIN + 10, y, `Placas:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 70, y, truncate(siniestro.placas || "N/A", 20), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 300, y, `Licencia:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 360, y, `${siniestro.licencia_numero || "N/A"} (${siniestro.tipo_licencia || "CHOFER"})`, { fontSize: 8.5, textColor: "#0f172a" });

  y -= 30;

  // 2. Detalles del Siniestro y Ubicación GPS
  rect(commands, MARGIN, y - 110, CONTENT_WIDTH, 110, { fill: "#fff8f8", stroke: "#fca5a5" });
  rect(commands, MARGIN, y - 20, CONTENT_WIDTH, 20, { fill: "#dc2626", stroke: "#dc2626" });
  text(commands, MARGIN + 10, y - 14, "DETALLES DEL INCIDENTE Y UBICACION GPS DEL SINIESTRO", { fontSize: 9.5, isBold: true, textColor: "#ffffff" });

  y -= 34;
  text(commands, MARGIN + 10, y, `Tipo de Siniestro:`, { fontSize: 9, isBold: true, textColor: "#991b1b" });
  text(commands, MARGIN + 105, y, String(siniestro.tipo_siniestro || "SINIESTRO GENERAL").toUpperCase(), { fontSize: 9, isBold: true, textColor: "#b91c1c" });

  y -= 16;
  text(commands, MARGIN + 10, y, `Latitud:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 60, y, String(siniestro.latitud ?? "N/A"), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 180, y, `Longitud:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 235, y, String(siniestro.longitud ?? "N/A"), { fontSize: 8.5, textColor: "#0f172a" });

  text(commands, MARGIN + 360, y, `Altitud GPS:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  text(commands, MARGIN + 430, y, siniestro.altitud ? `${siniestro.altitud} m.s.n.m.` : "N/A", { fontSize: 8.5, isBold: true, textColor: "#0284c7" });

  y -= 18;
  text(commands, MARGIN + 10, y, `Descripción:`, { fontSize: 8.5, isBold: true, textColor: "#334155" });
  const descText = truncate(siniestro.descripcion || "Sin descripción proporcionada por el conductor.", 140);
  const descLines = descText.match(/.{1,90}(?:\s|$)|\S{1,90}/g) || [descText];
  descLines.slice(0, 2).forEach((value, index) => text(commands, MARGIN + 75, y - index * 11, value.trim(), { fontSize: 8, textColor: "#1e293b" }));

  y -= 27;
  if (siniestro.latitud && siniestro.longitud) {
    const mapsUrl = `https://www.google.com/maps?q=${siniestro.latitud},${siniestro.longitud}`;
    text(commands, MARGIN + 10, y, `Google Maps: ${mapsUrl}`, { fontSize: 8, textColor: "#2563eb" });
  }

  y -= 30;

  // 3. Evidencias Fotográficas
  rect(commands, MARGIN, y - 20, CONTENT_WIDTH, 20, { fill: "#334155", stroke: "#334155" });
  text(commands, MARGIN + 10, y - 14, `EVIDENCIAS FOTOGRAFICAS ADJUNTAS (${photoObjIds.length} FOTO(S))`, { fontSize: 9.5, isBold: true, textColor: "#ffffff" });

  y -= 30;

  if (photoObjIds.length > 0) {
    const columns = photoObjIds.length === 1 ? 1 : photoObjIds.length === 2 ? 2 : 3;
    const gapX = 10;
    const boxW = (CONTENT_WIDTH - (columns - 1) * gapX) / columns;
    const boxH = columns === 1 ? 190 : 125;
    const gapY = 10;

    for (let i = 0; i < photoObjIds.length && i < 6; i += 1) {
      const colIdx = i % columns;
      const rowIdx = Math.floor(i / columns);
      const px = MARGIN + colIdx * (boxW + gapX);
      const py = y - (rowIdx + 1) * boxH - rowIdx * gapY;

      rect(commands, px, py, boxW, boxH, { fill: "#f1f5f9", stroke: "#94a3b8", lineWidth: 0.8 });
      const imgRef = `ImPhoto${i + 1}`;
      const size = photoSizes[i];
      const scale = Math.min((boxW - 8) / size.width, (boxH - 8) / size.height);
      const w = size.width * scale, h = size.height * scale;
      commands.push(`q ${w} 0 0 ${h} ${px + (boxW - w) / 2} ${py + (boxH - h) / 2} cm /${imgRef} Do Q`);
    }

    y -= (Math.ceil(Math.min(photoObjIds.length, 6) / columns) * (boxH + gapY));
  } else {
    rect(commands, MARGIN, y - 40, CONTENT_WIDTH, 40, { fill: "#f8fafc", stroke: "#cbd5e1" });
    text(commands, MARGIN + 15, y - 24, "No se adjuntaron fotografías al momento de generar este reporte.", { fontSize: 8.5, textColor: "#64748b" });
    y -= 50;
  }

  // Pie de Página y Firma de Conformidad
  const footerY = Math.max(55, y - 75);
  rect(commands, MARGIN, footerY, CONTENT_WIDTH, 50, { fill: "#ffffff", stroke: "#cbd5e1" });
  text(commands, MARGIN + 20, footerY + 32, "______________________________________", { textColor: "#64748b" });
  text(commands, MARGIN + 40, footerY + 18, "Firma / Declaración del Conductor", { fontSize: 8, isBold: true, textColor: "#334155" });

  text(commands, MARGIN + CONTENT_WIDTH - 200, footerY + 32, "______________________________________", { textColor: "#64748b" });
  text(commands, MARGIN + CONTENT_WIDTH - 180, footerY + 18, "Revisión / Validación de QHSE y Supervisión", { fontSize: 8, isBold: true, textColor: "#334155" });

  text(commands, MARGIN + CONTENT_WIDTH / 2, 18, "Documento generado automáticamente por el Sistema de Gerenciamiento de Viajes", { fontSize: 7.5, textColor: "#94a3b8", align: "center" });

  const fontHelveticaObjId = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  const fontHelveticaBoldObjId = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  const xObjectDicts = [`/ImLogo ${logoImgObjId} 0 R`];
  photoObjIds.forEach((id, idx) => {
    xObjectDicts.push(`/ImPhoto${idx + 1} ${id} 0 R`);
  });

  const contentStream = Buffer.from(commands.join("\n"), "latin1");
  const contentsObjId = addObject(
    streamObject(`/Filter /FlateDecode`, deflateSync(contentStream))
  );

  const pageObjId = addObject(
    `<< /Type /Page /Parent ${objects.length + 2} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentsObjId} 0 R /Resources << /Font << /F1 ${fontHelveticaObjId} 0 R /F2 ${fontHelveticaBoldObjId} 0 R >> /XObject << ${xObjectDicts.join(" ")} >> >> >>`
  );

  const pagesObjId = addObject(
    `<< /Type /Pages /Count 1 /Kids [${pageObjId} 0 R] >>`
  );

  const catalogObjId = addObject(
    `<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`
  );

  let offset = 0;
  const pdfHeader = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  const bodyBuffers = [Buffer.from(pdfHeader, "latin1")];
  const xrefOffsets = [0];

  objects.forEach((obj, idx) => {
    xrefOffsets.push(offset + bodyBuffers.reduce((acc, b) => acc + b.length, 0));
    const objHeader = `${idx + 1} 0 obj\n`;
    const objFooter = "\nendobj\n";
    if (Buffer.isBuffer(obj)) {
      bodyBuffers.push(Buffer.from(objHeader, "latin1"), obj, Buffer.from(objFooter, "latin1"));
    } else {
      bodyBuffers.push(Buffer.from(`${objHeader}${obj}${objFooter}`, "latin1"));
    }
  });

  const startXref = offset + bodyBuffers.reduce((acc, b) => acc + b.length, 0);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(xrefOffsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  bodyBuffers.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(bodyBuffers);
}
