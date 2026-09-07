import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGerenciamientoPdf } from "../services/gerenciamiento-pdf.service.js";

async function main() {
  console.log("=== PROBANDO GENERACIÓN DE PDF OFICIAL SII-MX-23-LOG-003 ===");
  const sample = {
    folio_documento: "SII-MX-23-LOG-003",
    version_documento: "3.0",
    fecha_emision: new Date(),
    nombre_conductor: "Eduardo Josué Tovar García",
    tipo_vehiculo: "MITSUBISHI L200",
    placa: "CN2549B",
    modelo: "L200",
    color: "BLANCO",
    numero_unidad: "AQR-028",
    origen_nombre: "Base Perú",
    destino_nombre: "Casa Uayamón",
    kilometraje: 13,
    tiempo_viaje_horas: "1.50",
    nivel_riesgo: "BAJO",
    puntaje_total: 15,
    sitios_reporte: [
      { punto: "carretera merida, paraje turistico", horaReportada: "10:30 AM" },
      { punto: "entronque Chiná, gasolinera", horaReportada: "11:15 AM" },
      { punto: "paradero turistico Uyamón", horaReportada: "12:00 PM" }
    ]
  };

  const pdf = buildGerenciamientoPdf(sample);
  console.log("PDF generado exitosamente:", pdf.nombre, "Tamaño:", pdf.buffer.length, "bytes");

  const outputPath = resolve(process.cwd(), "test_gerenciamiento_oficial.pdf");
  await writeFile(outputPath, pdf.buffer);
  console.log("Archivo guardado en:", outputPath);
}

main().catch((err) => console.error("Error probando PDF:", err));
