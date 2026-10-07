import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { databasePool } from "../database/pool.js";
import { classifyAuditEvent, listAuditLogs, sanitizeAuditDetails, writeAuditLog } from "../services/audit-log.service.js";

test("oculta credenciales, archivos y coordenadas de la bitácora", () => {
  const safe = sanitizeAuditDetails({
    idViaje: 15, password: "secreto", token: "jwt", firma: "base64",
    latitud: 19.4326, longitud: -99.1332, acompanantes: [{ nombre: "Persona" }],
    usoTemporal: { mode: "SOLO_HOY" }
  });
  assert.equal(safe.idViaje, 15);
  assert.equal(safe.password, "[REDACTADO]");
  assert.equal(safe.token, "[REDACTADO]");
  assert.equal(safe.firma, "[REDACTADO]");
  assert.equal(safe.latitud, "[UBICACION_OMITIDA]");
  assert.equal(safe.longitud, "[UBICACION_OMITIDA]");
  assert.deepEqual(safe.acompanantes, { cantidad: 1 });
  assert.equal(safe.usoTemporal.mode, "SOLO_HOY");
});

test("clasifica accesos, viajes, inspecciones y GPS", () => {
  assert.equal(classifyAuditEvent("POST", "/api/admin/auth/login", 200), "INICIO_SESION");
  assert.equal(classifyAuditEvent("POST", "/api/viajes", 403), "ACCESO_DENEGADO");
  assert.equal(classifyAuditEvent("POST", "/api/viajes/1/inspeccion", 200), "CAMBIO_INSPECCION");
  assert.equal(classifyAuditEvent("POST", "/api/viajes/1/ubicaciones/lote", 200), "REGISTRO_GPS");
});

test("persiste y consulta una entrada ficticia de auditoría", async (t) => {
  const requestId = randomUUID();
  t.after(() => databasePool.query("DELETE FROM bitacora_auditoria WHERE request_id=$1", [requestId]));
  await writeAuditLog({
    requestId, level: "INFO", event: "CAMBIO_VIAJE", method: "POST",
    path: "/api/viajes", status: 201, durationMs: 12, actorType: "CONDUCTOR",
    actorId: 999999, actorName: "USUARIO FICTICIO", actorEmail: null,
    authSource: "PRUEBA", ip: "127.0.0.1", userAgent: "node-test",
    details: { idVehiculo: 123 }
  });
  const result = await listAuditLogs({ actorType: "CONDUCTOR", actorId: 999999, limit: 10 });
  const row = result.rows.find(item => item.request_id === requestId);
  assert.equal(row.evento, "CAMBIO_VIAJE");
  assert.equal(row.detalles.idVehiculo, 123);
});
