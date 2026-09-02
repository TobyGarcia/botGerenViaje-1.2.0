import {
  Router
} from "express";

import {
  assignAdminConductorVehicleController,
  createAdminDriverController,
  listAdminDriversController,
  updateAdminDriverStatusController,
  approveAdminDriverController,
  setDriverPinAdminController
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

router.patch(
  "/:idConductor/aprobar",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  approveAdminDriverController
);

router.patch(
  "/:idConductor/pin",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  setDriverPinAdminController
);

export default router;

