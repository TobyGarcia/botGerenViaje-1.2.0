import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFiles() {
  const possiblePaths = [
    path.join(__dirname, "../../../.env"),
    path.join(__dirname, "../../.env"),
    path.join(__dirname, "../../../.env.production"),
    path.join(__dirname, "../../../.env.prod")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Cargando variables desde ${p}...`);
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const parts = trimmed.split("=");
          const key = parts[0].trim();
          let val = parts.slice(1).join("=").trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

async function run() {
  try {
    loadEnvFiles();
    const connStr = process.env.DATABASE_URL || "postgresql://viajes_admin_prod:viajes_password_prod@127.0.0.1:5432/gerenciamiento_viajes_prod";
    console.log("Conectando a base de datos con URL:", connStr.replace(/:[^:@]+@/, ":****@"));
    
    const pool = new Pool({ connectionString: connStr });
    const migrationPath = path.join(__dirname, "../../../database/migrations/030_control_turnos_vehiculo.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log("Ejecutando migración 030_control_turnos_vehiculo.sql...");
    await pool.query(sql);
    console.log("✅ Migración 030 ejecutada exitosamente.");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error ejecutando migración 030:", err.message);
    process.exit(1);
  }
}

run();
