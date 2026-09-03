import { Router } from "express";
import { getAdminAnaliticaCombustibleController } from "../controllers/admin-analitica-combustible.controller.js";
import { requireAdminSession, requireAdminRoles, ROLES_SUPERVISOR_Y_SUPERIOR } from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(requireAdminSession);

router.get(
  "/",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  getAdminAnaliticaCombustibleController
);

export default router;
