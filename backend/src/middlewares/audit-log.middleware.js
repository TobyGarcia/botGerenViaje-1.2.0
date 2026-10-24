import { randomUUID } from "node:crypto";
import { classifyAuditEvent } from "../services/audit-log.service.js";
import { auditContext, auditWriter, validRequestId } from "../services/operation-log.service.js";

export function auditRequest(request, response, next) {
  const started = process.hrtime.bigint();
  const suppliedId = request.get("X-Request-Id");
  const requestId = validRequestId(suppliedId) ? suppliedId : randomUUID();
  request.auditRequestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  let logged = false;
  const onComplete = () => {
    if (logged) return;
    logged = true;
    if (request.originalUrl.startsWith("/health") || request.originalUrl.startsWith("/api/diagnosticos")) return;
    const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - started) / 1e6));
    const admin = request.adminUser;
    const driver = request.driverUser;
    const status = response.writableFinished ? response.statusCode : 499;
    const entry = {
      requestId,
      eventId: randomUUID(),
      step: "http", result: status >= 400 ? "ERROR_HTTP" : "RESPUESTA",
      version: process.env.APP_VERSION || "local",
      tripId: Number(request.originalUrl.match(/\/viajes\/(\d+)/)?.[1]) || null,
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
      details: {
        idViaje: request.body?.idViaje,
        idConductor: request.body?.idConductor,
        idVehiculo: request.body?.idVehiculo,
        cantidad: Array.isArray(request.body?.ubicaciones) ? request.body.ubicaciones.length : undefined
      }
    };
    auditWriter.write(entry);
  };
  response.once("finish", onComplete);
  response.once("close", onComplete);
  auditContext.run({ requestId, request }, next);
}
