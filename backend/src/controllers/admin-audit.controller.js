import { listAuditLogs } from "../services/audit-log.service.js";
import { validRequestId } from "../services/operation-log.service.js";

export async function listAuditLogsController(request, response) {
  try {
    const q = request.query;
    for (const key of ["page", "limit", "actorId", "tripId", "status"]) {
      if (q[key] !== undefined && (!/^\d+$/.test(String(q[key])) || !Number.isSafeInteger(Number(q[key])) || Number(q[key]) < 1))
        return response.status(400).json({ success: false, message: "Filtro numérico inválido." });
    }
    if ((q.requestId && !validRequestId(q.requestId)) ||
        (q.level && !["INFO", "WARN", "ERROR"].includes(q.level)) ||
        (q.actorType && !["ADMIN", "CONDUCTOR", "ANONIMO"].includes(q.actorType)) ||
        ["from", "to"].some(key => q[key] && !Number.isFinite(Date.parse(q[key]))) ||
        (q.from && q.to && Date.parse(q.from) > Date.parse(q.to))) {
      return response.status(400).json({ success: false, message: "Filtros inválidos." });
    }
    const data = await listAuditLogs({
      page: request.query.page, limit: request.query.limit, event: request.query.event,
      actorType: request.query.actorType,
      actorId: request.query.actorId ? Number(request.query.actorId) : null,
      status: request.query.status ? Number(request.query.status) : null,
      from: q.from, to: q.to, requestId: q.requestId, level: q.level, tripId: q.tripId, folio: q.folio
    });
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(503).json({ success: false, message: "La auditoría no está disponible temporalmente." });
  }
}
