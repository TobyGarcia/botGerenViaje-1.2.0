/**
 * Genera y descarga una imagen PNG en alta definición con el PIN de 4 dígitos y nombre del conductor.
 * Utiliza HTML5 Canvas 2D nativo sin librerías externas.
 *
 * @param {Object} options
 * @param {string} options.nombre - Nombre del conductor
 * @param {string} options.pin - Código PIN de 4 dígitos
 * @param {string} [options.empresa] - Empresa (opcional)
 */
export function downloadPinCardImage({ nombre, pin, empresa }) {
  const width = 640;
  const height = 400;
  const scale = 2; // Doble resolución para nitidez en pantallas Retina y móviles

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Función auxiliar para dibujar rectángulos redondeados con compatibilidad hacia atrás
  function drawRoundedRect(x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    }
  }

  // Tarjeta principal con esquinas redondeadas
  const cardRadius = 20;
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(0, 0, width, height, cardRadius);
  ctx.clip();

  // Fondo con degradado elegante institucional (azul marino a petróleo)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0b2536");
  bgGrad.addColorStop(1, "#15425b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Barra superior decorativa brillante
  const barGrad = ctx.createLinearGradient(0, 0, width, 0);
  barGrad.addColorStop(0, "#0284c7");
  barGrad.addColorStop(0.5, "#38bdf8");
  barGrad.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, width, 6);

  // Marca / Sistema
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SISTEMA DE GESTIÓN DE VIAJES  •  SEGURIDAD VIAL", 36, 46);

  // Título principal
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Credencial de Acceso", 36, 78);

  // Línea divisoria sutil
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 96);
  ctx.lineTo(width - 36, 96);
  ctx.stroke();

  // Sección Conductor
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("CONDUCTOR ASIGNADO", 36, 126);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const driverName = (nombre || "Conductor").trim();
  const truncatedName = driverName.length > 34 ? driverName.slice(0, 34) + "..." : driverName;
  ctx.fillText(truncatedName, 36, 154);

  if (empresa) {
    ctx.fillStyle = "#7dd3fc";
    ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Empresa: ${empresa}`, 36, 174);
  }

  // Caja contenedora del PIN
  const boxX = 36;
  const boxY = empresa ? 190 : 176;
  const boxW = width - 72;
  const boxH = 114;

  ctx.fillStyle = "rgba(7, 18, 27, 0.75)";
  ctx.beginPath();
  drawRoundedRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5;
  if (ctx.setLineDash) ctx.setLineDash([6, 5]);
  ctx.stroke();
  if (ctx.setLineDash) ctx.setLineDash([]);

  // Título del PIN en la caja
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🔑 TU PIN DE ACCESO DE 4 DÍGITOS:", width / 2, boxY + 28);

  // Dígitos del PIN (Grandes y espaciados)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Courier New', Courier, monospace";
  const formattedPin = String(pin || "----").split("").join("   ");
  ctx.fillText(formattedPin, width / 2, boxY + 82);

  // Pie de nota de seguridad
  ctx.textAlign = "left";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("📌 Guarda esta credencial para ingresar al bot de Telegram.", 36, 342);

  // Fecha de expedición
  const todayStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  ctx.fillStyle = "#64748b";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Emitido: ${todayStr}`, 36, 368);

  ctx.restore();

  // Crear descarga directa
  const safeName = (nombre || "Conductor").trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, "_");
  const fileName = `PIN_${safeName}_${pin}.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }, "image/png");
}
