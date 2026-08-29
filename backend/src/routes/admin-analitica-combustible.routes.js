import { Router } from "express";
import { getAdminAnaliticaCombustibleController } from "../controllers/admin-analitica-combustible.controller.js";
import { requireAdminSession, requireAdminRoles } from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(requireAdminSession);

router.get(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"),
  getAdminAnaliticaCombustibleController
);

export default router;
