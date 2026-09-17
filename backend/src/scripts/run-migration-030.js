import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { databasePool } from "../database/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const migrationPath = path.join(__dirname, "../../../database/migrations/030_control_turnos_vehiculo.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log("Ejecutando migración 030_control_turnos_vehiculo.sql...");
    await databasePool.query(sql);
    console.log("✅ Migración 030 ejecutada exitosamente.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error ejecutando migración 030:", err.message);
    process.exit(1);
  }
}

run();
