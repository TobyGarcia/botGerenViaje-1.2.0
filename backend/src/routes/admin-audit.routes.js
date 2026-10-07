import { Router } from "express";
import { listAuditLogsController } from "../controllers/admin-audit.controller.js";
import { requireAdminRoles, requireAdminSession, ROLES_SUPERVISOR_Y_SUPERIOR } from "../middlewares/admin-auth.middleware.js";

const router = Router();
router.get("/", requireAdminSession, requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), listAuditLogsController);
export default router;
