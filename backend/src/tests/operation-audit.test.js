import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import { databasePool } from "../database/pool.js";
import { writeAuditLog, listAuditLogs } from "../services/audit-log.service.js";
import { auditContext, auditWriter, createAuditWriter, traceOperation, safeError, validRequestId } from "../services/operation-log.service.js";
import { normalizeClientEvent, receiveDiagnostics, acceptDiagnosticBatch } from "../services/client-diagnostics.service.js";
import auditRoutes from "../routes/admin-audit.routes.js";
import diagnosticsRoutes from "../routes/client-diagnostics.routes.js";
process.env.AUDIT_PERSIST_ALL_LEVELS = "true";
import { auditRequest } from "../middlewares/audit-log.middleware.js";
import { createAdminSessionToken } from "../utils/admin-session.js";

process.env.AUDIT_PERSISTENCE = "true";
process.env.AUDIT_STDOUT = "false";
process.env.ADMIN_JWT_SECRET = "isolated-test-secret-never-production";
const db = new PGlite();
const oldQuery = databasePool.query;
databasePool.query = async (sql, params) => {
  const result = await db.query(sql, params);
  return { ...result, rowCount: result.fields?.length ? result.rows.length : result.affectedRows ?? 0 };
};
after(async () => { await auditWriter.flush(); databasePool.query = oldQuery; await db.close(); await databasePool.end(); });

test("migration preserves historic rows and supports repeated events per operation", async () => {
  const base = await readFile(new URL("../../../database/migrations/035_bitacora_auditoria.sql", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../database/migrations/038_auditoria_eventos.sql", import.meta.url), "utf8");
  await db.exec(base);
  const trace = randomUUID();
  await db.query("INSERT INTO bitacora_auditoria(request_id,nivel,evento,metodo,ruta,status_http,duracion_ms,actor_tipo) VALUES($1,'INFO','LEGACY','GET','/test',200,0,'ANONIMO')", [trace]);
  await db.exec(migration);
  await db.exec(migration);
  const event = { requestId: trace, eventId: randomUUID(), level: "INFO", event: "TEST", method: "POST", path: "/test",
    status: 200, durationMs: 1, actorType: "ANONIMO", details: { token: "SECRET", latitud: 20 } };
  await writeAuditLog(event);
  await writeAuditLog(event); // delivery retry
  await writeAuditLog({ ...event, eventId: randomUUID(), step: "finish" });
  const results = await listAuditLogs({ requestId: trace });
  assert.equal(results.total, 3);
  assert.ok(results.rows.some(row => row.evento === "LEGACY"));
  assert.ok(!JSON.stringify(results).includes("SECRET"));
  await db.exec("CREATE TABLE viajes(id_viajes BIGINT PRIMARY KEY,folio TEXT); INSERT INTO viajes VALUES(123,'TEST-FOLIO')");
});

test("nested steps preserve request ID, result, identifiers and original thrown error", async () => {
  const requestId = randomUUID();
  const inner = traceOperation("inspection", async () => ({ id_inspeccion: 4 }));
  const outer = traceOperation("trip", async () => { await inner(); return { id_viajes: 123, folio: "TEST-FOLIO" }; });
  const value = await auditContext.run({ requestId }, () => outer({ idConductor: 7 }));
  assert.equal(value.id_viajes, 123);
  const failure = Object.assign(new Error("secret user data"), { code: "23514", constraint: "chk_test", detail: "PIN 1234" });
  const failing = traceOperation("save", async () => { throw failure; });
  await assert.rejects(() => auditContext.run({ requestId }, () => failing({ idViaje: 123 })), error => error === failure);
  await auditWriter.flush();
  const result = await listAuditLogs({ requestId });
  assert.equal(result.total, 6);
  const fault = result.rows.find(row => row.resultado === "ERROR");
  assert.equal(fault.codigo_error, "23514");
  assert.equal(fault.detalles.constraint, "chk_test");
  assert.ok(!JSON.stringify(result).includes("secret user data"));
  assert.ok(!JSON.stringify(result).includes("PIN 1234"));
  assert.equal((await listAuditLogs({ folio: "TEST-FOLIO" })).total, 3);
});

test("bounded writer survives database failures and keeps stderr/stdout evidence", async () => {
  const output = [];
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const writer = createAuditWriter({ capacity: 2, output: e => output.push(e), persist: async () => { await hold; throw Object.assign(new Error("private"), { code: "ECONNREFUSED" }); } });
  for (let i = 0; i < 10; i++) writer.write({ event: "TEST", requestId: randomUUID() });
  release();
  await writer.flush();
  assert.equal(output.filter(e => e.type === "operation_audit").length, 10);
  assert.equal(output.filter(e => e.type === "audit_queue_full").length, 1);
  assert.equal(output.filter(e => e.type === "audit_write_error").length, 3);
  assert.ok(!JSON.stringify(output).includes("private"));
});

test("unexpected failures remain ERROR while known business rejections are WARN", async () => {
  const requestId = randomUUID();
  for (const error of [new Error('Inspección requerida'), Object.assign(new Error('Unavailable'), { status: 503 }), new Error('Unknown failure')]) {
    const failing = traceOperation('classification', async () => { throw error; });
    await assert.rejects(() => auditContext.run({ requestId }, () => failing()));
  }
  await auditWriter.flush();
  const rows = (await listAuditLogs({ requestId })).rows;
  assert.equal(rows.filter(row => row.nivel === 'WARN').length, 1);
  assert.equal(rows.filter(row => row.nivel === 'ERROR').length, 2);
});

test("client reports are allowlisted, idempotent and rate limited", async () => {
  const item = { id: randomUUID(), event: "API_ERROR", at: new Date().toISOString(), path: "/api/viajes",
    token: "SECRET", message: "private", latitud: 20, requestId: randomUUID(), status: 500 };
  const a = normalizeClientEvent(item, "CONDUCTOR:7");
  assert.equal(validRequestId(normalizeClientEvent({ ...item, requestId: undefined }, "CONDUCTOR:7").requestId), true);
  assert.ok(!JSON.stringify(a).includes("SECRET"));
  assert.ok(!JSON.stringify(a).includes("private"));
  assert.notEqual(a.eventId, normalizeClientEvent(item, "CONDUCTOR:8").eventId);
  assert.throws(() => normalizeClientEvent({ ...item, event: "FAKE" }, "CONDUCTOR:7"));
  const req = { driverUser: { id_conductores: 7 }, body: { events: [item] } };
  let response;
  const res = { status(n) { this.statusCode = n; return this; }, json(body) { response = body; return this; } };
  await receiveDiagnostics(req, res); await receiveDiagnostics(req, res);
  assert.deepEqual(response.accepted, [item.id]);
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM bitacora_auditoria WHERE event_id=$1", [a.eventId])).rows[0].n, 1);
  for (let i = 0; i < 6; i++) assert.equal(acceptDiagnosticBatch("TEST_ACTOR", 1000), true);
  assert.equal(acceptDiagnosticBatch("TEST_ACTOR", 1000), false);
  assert.equal(acceptDiagnosticBatch("TEST_ACTOR", 62000), true);
  assert.deepEqual(safeError({ message: "password", detail: "password", code: "23514" }), { code: "23514" });
});

test("actual audit routes allow administrators only, including direct API access", async () => {
  await db.exec(`CREATE TABLE conductores(id_conductores INT PRIMARY KEY,nombre TEXT,correo TEXT,telefono TEXT);
    CREATE TABLE usuarios_admin(id_usuarios_admin INT PRIMARY KEY,id_conductores INT,rol TEXT,activo BOOLEAN,ultimo_acceso_en TIMESTAMPTZ);
    INSERT INTO conductores VALUES(1,'TEST ADMIN','test@example.invalid','');
    INSERT INTO usuarios_admin VALUES(1,1,'ADMINISTRADOR',TRUE,NULL),(2,1,'SUPERVISOR',TRUE,NULL),(3,1,'GERENTE',TRUE,NULL);`);
  const app = express();
  app.use(auditRequest); app.use(express.json());
  app.use("/api/admin/auditoria", auditRoutes);
  app.use("/api/diagnosticos", diagnosticsRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of ["/api/admin/auditoria", "/api/admin/auditoria/issues"]) {
      assert.equal((await fetch(base + path)).status, 401);
      for (const id of [2, 3]) {
        const token = createAdminSessionToken({ id_usuarios_admin: id, rol: id === 2 ? "SUPERVISOR" : "GERENTE" });
        assert.equal((await fetch(base + path, { headers: { Authorization: "Bearer " + token } })).status, 403);
      }
      const token = createAdminSessionToken({ id_usuarios_admin: 1, rol: "ADMINISTRADOR" });
      assert.equal((await fetch(base + path, { headers: { Authorization: "Bearer " + token, "X-Request-Id": "invalid" } })).status, 200);
    }
    const token = createAdminSessionToken({ id_usuarios_admin: 1, rol: "ADMINISTRADOR" });
    assert.equal((await fetch(base + "/api/admin/auditoria?requestId=invalid", { headers: { Authorization: "Bearer " + token } })).status, 400);
    assert.equal((await fetch(base + "/api/diagnosticos/driver", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: [] }) })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await auditWriter.flush();
  }
});
