import fs from "node:fs";
import path from "node:path";
import { databasePool } from "../database/pool.js";

// Parser de CSV que maneja comillas dobles, saltos de línea y UTF-8 BOM
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function disambiguateDestinations(destinations) {
  const nameCounts = new Map();
  for (const item of destinations) {
    const key = (item.nombre || "").trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  const seenFinalNames = new Set();
  const processed = [];

  for (const item of destinations) {
    let finalName = (item.nombre || "").trim();
    const key = finalName.toLowerCase();

    if (nameCounts.get(key) > 1) {
      const direccion = item.direccion || "";
      const parts = direccion.split(",").map((p) => p.trim()).filter(Boolean);
      let ref = "";

      if (parts.length >= 2) {
        const coloniaCandidate =
          parts.find((p) =>
            /barrio|colonia|fracc|centro|zona|residencial|villa|unidad/i.test(p)
          ) || parts[1];
        ref = coloniaCandidate.replace(/^\d{5}\s*/, "").trim();
      } else if (parts.length === 1) {
        ref = parts[0];
      }

      if (!ref) ref = "Sucursal";

      finalName = `${item.nombre} (${ref})`;
      if (finalName.length > 150) {
        finalName = finalName.slice(0, 149) + ")";
      }

      if (seenFinalNames.has(finalName.toLowerCase())) {
        const street = parts[0] || "";
        finalName = `${item.nombre} (${ref} - ${street})`.slice(0, 150);
      }

      let counter = 2;
      while (seenFinalNames.has(finalName.toLowerCase())) {
        const suffix = ` #${counter}`;
        const base = finalName.slice(0, 150 - suffix.length);
        finalName = `${base}${suffix}`;
        counter++;
      }
    }

    seenFinalNames.add(finalName.toLowerCase());
    processed.push({
      ...item,
      nombre: finalName
    });
  }

  return processed;
}

export async function importDestinationsFromRows(destinations) {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return { total: 0, inserted: 0, updated: 0 };
  }

  const disambiguated = disambiguateDestinations(destinations);
  const client = await databasePool.connect();

  let inserted = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    const BATCH_SIZE = 100;
    for (let i = 0; i < disambiguated.length; i += BATCH_SIZE) {
      const batch = disambiguated.slice(i, i + BATCH_SIZE);

      for (const dest of batch) {
        const nombre = String(dest.nombre || "").trim();
        if (!nombre) continue;

        const direccion = dest.direccion ? String(dest.direccion).trim() : null;
        const lat =
          dest.latitud !== null && dest.latitud !== undefined && !isNaN(dest.latitud)
            ? Number(dest.latitud)
            : null;
        const lng =
          dest.longitud !== null && dest.longitud !== undefined && !isNaN(dest.longitud)
            ? Number(dest.longitud)
            : null;

        const res = await client.query(
          `
            INSERT INTO lugares (nombre, direccion, latitud, longitud, activo)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (nombre)
            DO UPDATE SET
              direccion = COALESCE(EXCLUDED.direccion, lugares.direccion),
              latitud = COALESCE(EXCLUDED.latitud, lugares.latitud),
              longitud = COALESCE(EXCLUDED.longitud, lugares.longitud),
              activo = TRUE,
              actualizado_en = CURRENT_TIMESTAMP
            RETURNING (xmax = 0) AS was_inserted
          `,
          [nombre, direccion, lat, lng]
        );

        if (res.rows[0]?.was_inserted) {
          inserted++;
        } else {
          updated++;
        }
      }
    }

    await client.query("COMMIT");
    return {
      total: disambiguated.length,
      inserted,
      updated
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runStandalone() {
  const possiblePaths = [
    path.resolve(process.cwd(), "CSV/SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv"),
    path.resolve(process.cwd(), "../CSV/SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv"),
    path.resolve(process.cwd(), "../../CSV/SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv")
  ];

  let csvFilePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!csvFilePath) {
    console.error("❌ No se encontró el archivo CSV en ninguna de las rutas esperadas.");
    process.exit(1);
  }

  console.log(`📂 Leyendo archivo CSV desde: ${csvFilePath}...`);
  const rawText = fs.readFileSync(csvFilePath, "utf8");
  const rows = parseCSV(rawText);

  if (rows.length <= 1) {
    console.error("❌ El archivo CSV está vacío o no contiene filas de datos.");
    process.exit(1);
  }

  console.log(`📊 Total de filas detectadas (incluye encabezado): ${rows.length}`);
  const header = rows[0].map((h) => h.toLowerCase());
  console.log(`Encabezados detectados:`, header);

  // Determinar índices de columnas
  const idxNombre = header.findIndex((h) => h.includes("nombre"));
  const idxDireccion = header.findIndex((h) => h.includes("direccion"));
  const idxLongitud = header.findIndex((h) => h.includes("longitud"));
  const idxLatitud = header.findIndex((h) => h.includes("latitud"));

  const dataRows = rows.slice(1).map((r) => ({
    nombre: idxNombre !== -1 ? r[idxNombre] : r[0],
    direccion: idxDireccion !== -1 ? r[idxDireccion] : r[1],
    longitud: idxLongitud !== -1 ? parseFloat(r[idxLongitud]) : parseFloat(r[2]),
    latitud: idxLatitud !== -1 ? parseFloat(r[idxLatitud]) : parseFloat(r[3])
  }));

  console.log(`🔄 Iniciando inserción transaccional de ${dataRows.length} destinos en PostgreSQL...`);
  const startTime = Date.now();
  const result = await importDestinationsFromRows(dataRows);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("✅ Importación completada con éxito:");
  console.log(`   - Total procesados: ${result.total}`);
  console.log(`   - Nuevos destinos insertados: ${result.inserted}`);
  console.log(`   - Destinos actualizados/reactivados: ${result.updated}`);
  console.log(`   - Tiempo transcurrido: ${duration}s`);

  await databasePool.end();
}

// Ejecutar si se llama directamente
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectExecution || process.argv[1]?.includes("import-destinos-csv")) {
  runStandalone().catch((err) => {
    console.error("❌ Error durante la importación:", err);
    process.exit(1);
  });
}
