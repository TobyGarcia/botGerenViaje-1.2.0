import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildInspectionPdf } from "../services/inspeccion-pdf.service.js";

const outputDirectory = resolve(process.cwd(), "../output/pdf");
const sample = {
  id_viajes: 2463,
  id_inspeccion: 1,
  folio: "VIA-20260803-001",
  estado: "APROBADA",
  aprobado_en: new Date().toISOString(),
  aprobador: "Administrador de prueba",
  comentario_aprobacion: "Unidad autorizada para iniciar operaciones.",
  numero_economico: "AQR-05",
  placas: "CR-1234-A",
  marca: "Mitsubishi",
  modelo: "L300",
  tipo_vehiculo: "Camioneta",
  numero_serie: "SERIE-DE-MUESTRA",
  kilometraje_inicial: 100096,
  numero_poliza: "POL-2026-001",
  seguro_vencimiento: "2027-08-03",
  conductor: "Conductor de prueba",
  licencia_numero: "LIC-001",
  tipo_licencia: "Federal B",
  licencia_vigente: true,
  combustible: "3/4",
  tipo_asignacion: "PERMANENTE",
  danos: { frontal: [], trasera: [{ x: 50, y: 42 }], conductor: [], pasajero: [] },
  checklist: {
    "Tarjeta de circulación vigente": "B",
    "Póliza de seguro vigente": "B",
    "Verificación vigente": "B",
    "Extintor - carga vigente": "B",
    "Botiquín": "B",
    "Neumáticos": "R",
    "Luces delanteras": "B",
    "Limpieza interior": "B",
    "Limpieza exterior": "R"
  },
  observaciones_conductor: "Marca registrada en la vista trasera para revisión del coordinador."
};

await mkdir(outputDirectory, { recursive: true });
const result = buildInspectionPdf(sample);
await writeFile(resolve(outputDirectory, "reporte-inspeccion-vehicular-muestra.pdf"), result.buffer);
