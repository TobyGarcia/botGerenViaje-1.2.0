import {
  Router
} from "express";

import {
  assignAdminConductorVehicleController,
  createAdminDriverController,
  listAdminDriversController,
  updateAdminDriverStatusController
} from "../controllers/admin-conductores.controller.js";

import {
  requireAdminSession
} from "../middlewares/admin-auth.middleware.js";
import { requireAdminRoles } from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  listAdminDriversController
);

router.post(
  "/",
  requireAdminRoles("ADMINISTRADOR"),
  createAdminDriverController
);

router.patch(
  "/:idConductor/estado",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminDriverStatusController
);

router.patch(
  "/:idConductor/asignar-vehiculo",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  assignAdminConductorVehicleController
);

export default router;
