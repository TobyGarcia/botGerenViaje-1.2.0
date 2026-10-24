import { createHash } from "node:crypto";
import { writeAuditLog } from "./audit-log.service.js";
import { validRequestId } from "./operation-log.service.js";
import { publishTelegramAudit } from "./telegram-audit.service.js";

export const CLIENT_EVENTS = new Set(["API_ERROR", "JS_ERROR", "JS_REJECTION", "RENDER_ERROR",
  "GPS_STORAGE_ERROR", "OFFLINE_STORAGE_ERROR", "GPS_SYNC", "GPS_ERROR", "APP_UPDATE"]);
const buckets = new Map();
export function acceptDiagnosticBatch(actor, now = Date.now()) {
  const previous = buckets.get(actor);
  if (previous && now - previous.at < 60000) {
    if (previous.count >= 6) return false;
    previous.count++;
    return true;
  }
  for (const [key, value] of buckets) if (now - value.at >= 60000) buckets.delete(key);
  if (buckets.size >= 10000) return false;
  buckets.set(actor, { at: now, count: 1 });
  return true;
}
export function normalizeClientEvent(item, actor) {
  if (!item || !validRequestId(item.id) || !CLIENT_EVENTS.has(item.event)) throw new Error("INVALID_EVENT");
  // Scope idempotency by authenticated sender; never trust client supplied actor IDs.
  const hex = createHash("sha256").update(actor + ":" + item.id).digest("hex").slice(0,32);
  const eventId = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;
  const requestId = validRequestId(item.requestId) ? item.requestId : eventId;
  const status = Number.isInteger(item.status) && item.status >= 100 && item.status <= 599 ? item.status : 500;
  const code = /^[A-Z0-9_]{1,60}$/.test(item.code || "") ? item.code : "CLIENT_FAILURE";
  const path = /^\/api\/[a-zA-Z0-9_/-]{0,180}$/.test(item.path || "") ? item.path : "/client";
  return {
    eventId, requestId, event: item.event, step: "navegador",
    result: "REPORTADO", level: status < 500 ? "WARN" : "ERROR",
    method: "CLIENT", path, status, durationMs: 0,
    // A queued event can predate the current login; do not claim that the sender caused it.
    actorType: "ANONIMO", actorId: null,
    version: /^[a-zA-Z0-9_.-]{1,100}$/.test(item.version || "") ? item.version : null,
    errorCode: code,
    details: { enviadoPor: actor, fechaDispositivo: Number.isFinite(Date.parse(item.at)) ? new Date(item.at).toISOString() : null,
      online: typeof item.online === "boolean" ? item.online : null, origen: "CLIENTE_NO_VERIFICADO" }
  };
}
export async function receiveDiagnostics(request, response) {
  const user = request.adminUser || request.driverUser;
  const actor = (request.adminUser ? "ADMIN:" : "CONDUCTOR:") +
    (user?.id_usuarios_admin ?? user?.id_usuario_admin ?? user?.id_conductores);
  if (!acceptDiagnosticBatch(actor)) return response.status(429).json({ success: false });
  const items = request.body?.events;
  if (!Array.isArray(items) || items.length < 1 || items.length > 10 ||
      Buffer.byteLength(JSON.stringify(items)) > 16000) return response.status(400).json({ success: false });
  let entries;
  try { entries = items.map(item => normalizeClientEvent(item, actor)); }
  catch { return response.status(400).json({ success: false }); }
  try {
    for (const entry of entries) {
      const persisted = await writeAuditLog(entry);
      if (persisted || entry.level === "WARN") publishTelegramAudit(entry);
    }
    return response.json({ success: true, accepted: items.map(item => item.id) });
  } catch {
    return response.status(503).json({ success: false });
  }
}
