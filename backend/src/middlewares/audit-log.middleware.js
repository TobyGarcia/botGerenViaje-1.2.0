import { randomUUID } from "node:crypto";
import { classifyAuditEvent, sanitizeAuditDetails, writeAuditLog } from "../services/audit-log.service.js";

export function auditRequest(request, response, next) {
  const started = process.hrtime.bigint();
  const requestId = request.get("X-Request-Id") || randomUUID();
  request.auditRequestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  response.once("finish", () => {
    if (request.originalUrl.startsWith("/health")) return;
    const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - started) / 1e6));
    const admin = request.adminUser;
    const driver = request.driverUser;
    const status = response.statusCode;
    const entry = {
      requestId,
      level: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
      event: classifyAuditEvent(request.method, request.originalUrl, status),
      method: request.method,
      path: request.originalUrl.split("?")[0].slice(0, 1000),
      status,
      durationMs,
      actorType: admin ? "ADMIN" : driver ? "CONDUCTOR" : "ANONIMO",
      actorId: admin?.id_usuarios_admin ?? driver?.id_conductores ?? null,
      actorName: admin?.nombre ?? driver?.nombre ?? null,
      actorEmail: admin?.email ?? admin?.correo ?? null,
      authSource: request.authSource || (admin ? "ADMIN_SESSION" : null),
      ip: request.ip || request.socket?.remoteAddress || null,
      userAgent: String(request.get("user-agent") || "").slice(0, 500) || null,
      details: request.method === "GET" ? {} : sanitizeAuditDetails(request.body)
    };
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), type: "http_audit", ...entry }));
    void writeAuditLog(entry).catch(error => console.error(JSON.stringify({
      timestamp: new Date().toISOString(), type: "audit_write_error", requestId, message: error.message
    })));
  });
  next();
}
