import { databasePool } from "../database/pool.js";
import { randomUUID } from "node:crypto";

const SENSITIVE_KEY = /(password|contrasena|contraseña|token|secret|authorization|cookie|pin|firma|imagen|foto|documento|pdf|licencia_url|initdata)/i;
const LOCATION_KEY = /^(latitud|longitud|latitude|longitude|direccion|precision|velocidad)$/i;

export function sanitizeAuditDetails(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 2) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) { result[key] = "[REDACTADO]"; continue; }
    if (LOCATION_KEY.test(key)) { result[key] = "[UBICACION_OMITIDA]"; continue; }
    if (raw === null || ["string", "number", "boolean"].includes(typeof raw)) {
      result[key] = typeof raw === "string" ? raw.slice(0, 300) : raw;
    } else if (Array.isArray(raw)) {
      result[key] = { cantidad: raw.length };
    } else if (raw && typeof raw === "object") {
      result[key] = sanitizeAuditDetails(raw, depth + 1);
    }
  }
  return result;
}

export function classifyAuditEvent(method, path, status) {
  if (status >= 500) return "ERROR_SERVIDOR";
  if (status === 401 || status === 403) return "ACCESO_DENEGADO";
  if (/\/auth\/(login|pin-login|tenant-login|azure\/exchange-code)/.test(path)) return status < 400 ? "INICIO_SESION" : "INICIO_SESION_FALLIDO";
  if (/\/auth\/logout/.test(path)) return "CIERRE_SESION";
  if (/\/ubicaciones(\/|$)/.test(path)) return "REGISTRO_GPS";
  if (/\/inspeccion/.test(path)) return method === "GET" ? "CONSULTA_INSPECCION" : "CAMBIO_INSPECCION";
  if (/\/viajes/.test(path)) return method === "GET" ? "CONSULTA_VIAJE" : "CAMBIO_VIAJE";
  if (method === "GET") return "CONSULTA";
  if (method === "DELETE") return "ELIMINACION";
  return "CAMBIO_DATOS";
}

export async function writeAuditLog(entry) {
  // Production stores only failures. Full traces are enabled explicitly by isolated tests.
  if (entry.level !== "ERROR" && process.env.AUDIT_PERSIST_ALL_LEVELS !== "true") return false;
  const result = await databasePool.query(`INSERT INTO bitacora_auditoria
    (request_id,nivel,evento,metodo,ruta,status_http,duracion_ms,actor_tipo,actor_id,
     actor_nombre,actor_email,origen_autenticacion,ip,user_agent,detalles,
     event_id,paso,resultado,version_app,id_viaje,codigo_error)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$21)
    ON CONFLICT (event_id) DO NOTHING`, [
    entry.requestId, entry.level, entry.event, entry.method, entry.path, entry.status,
    entry.durationMs, entry.actorType, entry.actorId, entry.actorName, entry.actorEmail,
    entry.authSource, entry.ip, entry.userAgent, JSON.stringify(sanitizeAuditDetails(entry.details || {})),
    entry.eventId || randomUUID(), entry.step, entry.result, entry.version, entry.tripId, entry.errorCode
  ]);
  if (result.rowCount > 0 && entry.level === "ERROR") await pruneAuditErrors(100);
  return result.rowCount > 0;
}

export async function pruneAuditErrors(limit = 100) {
  const keep = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  return databasePool.query(`DELETE FROM bitacora_auditoria
    WHERE nivel='ERROR' AND id_bitacora < COALESCE((
      SELECT MIN(id_bitacora) FROM (
        SELECT id_bitacora FROM bitacora_auditoria
        WHERE nivel='ERROR' ORDER BY id_bitacora DESC LIMIT $1
      ) recientes
    ), 0)`, [keep]);
}

export async function listAuditLogs({ page = 1, limit = 50, event, actorType, actorId, status, from, to, requestId, level, tripId, folio }) {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  if (event) add("evento=?", event);
  if (actorType) add("actor_tipo=?", actorType);
  if (actorId) add("actor_id=?", actorId);
  if (status) add("status_http=?", status);
  if (from) add("fecha>=?", from);
  if (to) add("fecha<=?", to);
  if (requestId) add("request_id=?", requestId);
  if (level) add("nivel=?", level);
  if (tripId) add("id_viaje=?", tripId);
  if (folio) add("id_viaje IN (SELECT id_viajes FROM viajes WHERE folio=?)", folio);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const total = await databasePool.query(`SELECT COUNT(*)::int total FROM bitacora_auditoria ${clause}`, params);
  params.push(safeLimit, (safePage - 1) * safeLimit);
  const rows = await databasePool.query(`SELECT * FROM bitacora_auditoria ${clause}
    ORDER BY fecha DESC, id_bitacora DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { rows: rows.rows, total: total.rows[0].total, page: safePage, limit: safeLimit };
}

export async function purgeExpiredAuditLogs(retentionDays = 180) {
  const days = Math.min(Math.max(Number(retentionDays) || 180, 30), 3650);
  return databasePool.query("DELETE FROM bitacora_auditoria WHERE fecha < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')", [days]);
}

export async function listAuditIssues() {
  const result = await databasePool.query(`SELECT paso, codigo_error, evento,
    COUNT(*)::int cantidad, MAX(fecha) ultima_vez,
    (array_agg(request_id ORDER BY fecha DESC))[1] request_id
    FROM bitacora_auditoria WHERE nivel='ERROR'
      AND fecha >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY paso,codigo_error,evento ORDER BY ultima_vez DESC LIMIT 30`);
  return result.rows;
}
