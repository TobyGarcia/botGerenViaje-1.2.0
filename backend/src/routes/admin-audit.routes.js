import { Router } from "express";
import { listAuditIssues } from "../services/audit-log.service.js";
import { listAuditLogsController } from "../controllers/admin-audit.controller.js";
import { requireAdminRoles, requireAdminSession } from "../middlewares/admin-auth.middleware.js";
import { telegramAuditStatus } from "../services/telegram-audit.service.js";

const router = Router();
router.get("/issues", requireAdminSession, requireAdminRoles(["ADMINISTRADOR"]), async (req, res) => {
  try { return res.json({ success: true, data: await listAuditIssues(), notifications: telegramAuditStatus() }); }
  catch { return res.status(503).json({ success: false, message: "No se pudieron consultar los errores." }); }
});
router.get("/", requireAdminSession, requireAdminRoles(["ADMINISTRADOR"]), listAuditLogsController);
export default router;
