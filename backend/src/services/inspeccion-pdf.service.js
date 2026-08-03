function pdfEscape(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function wrap(value, width = 90) {
  const words = String(value ?? "").split(/\s+/);
  const lines = []; let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function buildInspectionPdf(data) {
  const emitted = new Date(data.aprobado_en || Date.now()).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const documentNumber = `SII-MX-${new Date().getFullYear()}-LOG-${String(data.id_viajes).padStart(3, "0")}`;
  const lines = [
    ["title", "REPORTE DE INSPECCION VEHICULAR"],
    ["meta", `Version: 2.2 | Area responsable: Logistica`],
    ["meta", `No. documento: ${documentNumber}`], ["meta", `Emision: ${emitted}`],
    ["heading", "DATOS GENERALES"],
    ["text", `Folio: ${data.folio} | Unidad: ${data.numero_economico} | Placas: ${data.placas || "N/A"}`],
    ["text", `Vehiculo: ${data.marca || ""} ${data.modelo || data.vehiculo || ""} | Tipo: ${data.tipo_vehiculo || "N/A"}`],
    ["text", `Serie: ${data.numero_serie || "N/A"} | Kilometraje: ${data.kilometraje_inicial} km`],
    ["text", `Poliza: ${data.numero_poliza || "N/A"} | Vencimiento: ${data.seguro_vencimiento || "N/A"}`],
    ["text", `Conductor: ${data.conductor} | Licencia: ${data.licencia_numero || "N/A"}`],
    ["text", `Tipo/vigencia licencia: ${data.tipo_licencia || "N/A"} / ${data.licencia_vigente ? "Vigente" : "No vigente"}`],
    ["text", `Combustible: ${data.combustible} | Asignacion: ${data.tipo_asignacion}`],
    ["heading", "INSPECCION VISUAL"],
    ...Object.entries(data.danos || {}).map(([view, points]) => ["text", `${view}: ${points.length ? `${points.length} marca(s) registrada(s)` : "Sin danos marcados"}`]),
    ["heading", "CHECKLIST"],
    ...Object.entries(data.checklist || {}).map(([item, state]) => ["text", `${state.padEnd(3, " ")}  ${item}`]),
    ["heading", "OBSERVACIONES"],
    ["text", data.observaciones_conductor || "Sin observaciones."],
    ["heading", "APROBACION"],
    ["text", `Estado: ${data.estado} | Aprobador: ${data.aprobador || "Pendiente"}`],
    ["text", `Comentario: ${data.comentario_aprobacion || "Sin comentarios"}`],
    ["text", "Firma del conductor: capturada digitalmente en el registro de inspeccion."],
  ];
  const pages = []; let page = []; let y = 790;
  for (const [type, raw] of lines) {
    const size = type === "title" ? 16 : type === "heading" ? 12 : 9;
    const leading = size + 5;
    for (const text of wrap(raw, type === "title" ? 60 : 95)) {
      if (y < 55) { pages.push(page); page = []; y = 790; }
      page.push({ type, text, y, size }); y -= leading;
    }
    if (type === "heading") y -= 3;
  }
  if (page.length) pages.push(page);
  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  pages.forEach((items, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1;
    const commands = items.map(item => `BT /F1 ${item.size} Tf ${item.type === "title" ? "0.05 0.28 0.38" : item.type === "heading" ? "0.05 0.55 0.7" : "0.12 0.22 0.27"} rg 50 ${item.y} Td (${pdfEscape(item.text)}) Tj ET`).join("\n");
    const footer = `BT /F1 8 Tf 0.4 g 270 28 Td (Pagina ${index + 1} de ${pages.length}) Tj ET`;
    const content = `${commands}\n${footer}`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });
  let pdf = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"); const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf = Buffer.concat([pdf, Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, "latin1")]); }
  const xref = pdf.length;
  let trailer = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) trailer += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { buffer: Buffer.concat([pdf, Buffer.from(trailer, "latin1")]), nombre: `inspeccion-${data.folio}.pdf` };
}
