import { listAuditLogs } from "../services/audit-log.service.js";

export async function listAuditLogsController(request, response) {
  try {
    const data = await listAuditLogs({
      page: request.query.page, limit: request.query.limit, event: request.query.event,
      actorType: request.query.actorType,
      actorId: request.query.actorId ? Number(request.query.actorId) : null,
      status: request.query.status ? Number(request.query.status) : null,
      from: request.query.from, to: request.query.to
    });
    return response.json({ success: true, data });
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message });
  }
}
