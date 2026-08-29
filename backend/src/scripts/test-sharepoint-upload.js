import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")];
for (const envFile of envFiles) {
  if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(envFile); } catch {}
  }
}

import { getSharePointFolderPath, parseSharePointTarget, uploadInspectionPdfToSharePoint } from "../services/sharepoint.service.js";

async function main() {
  console.log("=== PRUEBA DE CONFIGURACIÓN SHAREPOINT ===");

  const folderPath = getSharePointFolderPath({ baseFolder: "inspecciones", date: new Date("2026-08-29T10:00:00Z") });
  console.log("Ruta de subcarpetas generada (2026-08-29):", folderPath);

  const target = parseSharePointTarget();
  console.log("Destino SharePoint parseado:", target);

  console.log("\nProbando subida a SharePoint (requiere AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET en .env)...");

  // Crear un buffer PDF ficticio para pruebas
  const dummyPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n00000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF");

  const testFolio = `PRUEBA-TEST-${Date.now()}`;
  const result = await uploadInspectionPdfToSharePoint({
    folio: testFolio,
    pdfBuffer: dummyPdfBuffer,
    date: new Date()
  });

  console.log("\nResultado de subida:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error en la ejecución de la prueba:", err);
});
