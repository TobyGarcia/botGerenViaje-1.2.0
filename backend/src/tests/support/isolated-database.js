// Local PostgreSQL-compatible SQL engine, entirely in memory. Never uses DATABASE_URL.
// The adapter serializes connections; it does not replace multi-process PostgreSQL load tests.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after } from "node:test";
import { databasePool } from "../../database/pool.js";
import { auditWriter } from "../../services/operation-log.service.js";

process.env.AUDIT_STDOUT = "false";
process.env.AUDIT_PERSISTENCE = "true";
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN;
process.env.ADMIN_JWT_SECRET = "isolated-local-admin-secret";
process.env.DRIVER_JWT_SECRET = "isolated-local-driver-secret";
const db = new PGlite();
const base = new URL("../../../../database/", import.meta.url);
const manifest = await readFile(new URL("scripts/migrate.sql", base), "utf8");
for (const line of manifest.split("\n")) {
  const match = line.match(/^\\ir \.\.\/migrations\/(\S+)/);
  if (match) {
    const sql = (await readFile(new URL("migrations/" + match[1], base), "utf8")).replace(/^\uFEFF/, "");
    try { await db.exec(sql); } catch (error) { throw new Error(match[1] + ": " + error.message); }
  }
}
await db.exec("INSERT INTO estados_viaje(nombre,descripcion,activo) VALUES('PENDIENTE','Prueba',TRUE),('EN_CURSO','Prueba',TRUE),('FINALIZADO','Prueba',TRUE),('CANCELADO','Prueba',TRUE) ON CONFLICT(nombre) DO NOTHING");

let tail = Promise.resolve();
async function acquire() {
  let unlock;
  const current = new Promise(resolve => { unlock = resolve; });
  const previous = tail;
  tail = current;
  await previous;
  return unlock;
}
const query = async (sql, params) => {
  const result = await db.query(sql, params);
  return { ...result, rowCount: result.fields?.length ? result.rows.length : result.affectedRows ?? 0 };
};
databasePool.query = async (sql, params) => { const release = await acquire(); try { return await query(sql, params); } finally { release(); } };
databasePool.connect = async () => { const release = await acquire(); return { query, release }; };
after(async () => { await auditWriter.flush(); await db.close(); await databasePool.end(); });
