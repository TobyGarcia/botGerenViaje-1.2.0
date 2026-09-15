import { databasePool } from "../database/pool.js";
import { generateSiniestroPdf } from "./siniestro-pdf.service.js";
import { saveSiniestroPdfBuffer } from "../utils/file-storage.js";
import { sendSiniestroGroupAlert } from "../bot/bot.js";
import { sendSiniestroSupervisorAlert } from "../bot/supervisor-bot.js";

function formatFolio() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  return `SIN-${dateStr}-${randomStr}`;
}

export async function crearReporteSiniestro({
  idConductor,
  idVehiculo,
  tipoSiniestro,
  descripcion,
  latitud,
  longitud,
  altitud,
  fotos = []
}) {
  if (!idConductor) {
    throw new Error("Se requiere la sesión de un conductor válido.");
  }

  if (!tipoSiniestro || typeof tipoSiniestro !== "string" || !tipoSiniestro.trim()) {
    throw new Error("El tipo de siniestro es obligatorio.");
  }

  // 1. Consultar información completa del conductor y su vehículo asignado
  const driverRes = await databasePool.query(
    `SELECT 
       c.id_conductores,
       c.nombre,
       c.telefono,
       c.empresa,
       c.puesto,
       c.licencia_numero,
       c.tipo_licencia,
       v.id_vehiculos,
       v.marca,
       v.modelo,
       v.placas,
       v.numero_economico,
       v.tipo_vehiculo
     FROM conductores c
     LEFT JOIN vehiculos v ON v.id_conductor_asignado = c.id_conductores OR v.id_vehiculos = $2
     WHERE c.id_conductores = $1
     LIMIT 1`,
    [idConductor, idVehiculo || null]
  );

  const driverInfo = driverRes.rows[0] || {};
  const folio = formatFolio();
  const safeFotos = Array.isArray(fotos) ? fotos.slice(0, 6) : [];

  // 2. Insertar reporte en la base de datos
  const insertRes = await databasePool.query(
    `INSERT INTO siniestros (
       folio, id_conductores, id_vehiculo, tipo_siniestro, descripcion, latitud, longitud, altitud, fotos
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [
      folio,
      idConductor,
      driverInfo.id_vehiculos || idVehiculo || null,
      tipoSiniestro.trim(),
      descripcion ? String(descripcion).trim() : "",
      latitud ? Number(latitud) : null,
      longitud ? Number(longitud) : null,
      altitud ? Number(altitud) : null,
      JSON.stringify(safeFotos)
    ]
  );

  const siniestroRecord = insertRes.rows[0];

  const fullSiniestroData = {
    ...siniestroRecord,
    conductor_nombre: driverInfo.nombre || "Conductor",
    conductor_telefono: driverInfo.telefono || "N/A",
    empresa: driverInfo.empresa || "ITZAMNA",
    puesto: driverInfo.puesto || "N/A",
    licencia_numero: driverInfo.licencia_numero || "N/A",
    tipo_licencia: driverInfo.tipo_licencia || "CHOFER",
    vehiculo_nombre: driverInfo.marca ? `${driverInfo.marca} ${driverInfo.modelo || ""}`.trim() : "Sin vehículo asignado",
    placas: driverInfo.placas || "N/A",
    numero_economico: driverInfo.numero_economico || "N/A"
  };

  // 3. Generar PDF oficial
  let pdfBuffer = null;
  let pdfUrl = null;
  try {
    pdfBuffer = generateSiniestroPdf(fullSiniestroData);
    pdfUrl = saveSiniestroPdfBuffer(pdfBuffer, folio);

    if (pdfUrl) {
      await databasePool.query(
        `UPDATE siniestros SET pdf_url = $1 WHERE id_siniestros = $2`,
        [pdfUrl, siniestroRecord.id_siniestros]
      );
    }
  } catch (pdfErr) {
    console.error("Error al generar PDF del siniestro:", pdfErr.message);
  }

  // 4. Enviar alertas en segundo plano a los grupos de Telegram (Bot de viajes & Bot Supervisor)
  (async () => {
    try {
      await Promise.allSettled([
        sendSiniestroGroupAlert({ siniestro: fullSiniestroData, pdfBuffer }),
        sendSiniestroSupervisorAlert({ siniestro: fullSiniestroData, pdfBuffer })
      ]);
    } catch (err) {
      console.warn("Fallo al enviar alertas de siniestro a Telegram:", err.message);
    }
  })();

  return {
    ...fullSiniestroData,
    pdf_url: pdfUrl || null
  };
}

export async function listarSiniestros({ limit = 50, offset = 0 } = {}) {
  const result = await databasePool.query(
    `SELECT 
       s.*,
       c.nombre AS conductor_nombre,
       c.telefono AS conductor_telefono,
       c.empresa,
       c.puesto,
       v.placas,
       v.numero_economico
     FROM siniestros s
     LEFT JOIN conductores c ON c.id_conductores = s.id_conductores
     LEFT JOIN vehiculos v ON v.id_vehiculos = s.id_vehiculo
     ORDER BY s.creado_en DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}
