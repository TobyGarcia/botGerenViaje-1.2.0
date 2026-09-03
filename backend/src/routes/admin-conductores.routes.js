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
  requireAdminSession,
  requireAdminRoles,
  ROLES_SUPERVISOR_Y_SUPERIOR
} from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
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
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  assignAdminConductorVehicleController
);

router.patch(
  "/:idConductor/aprobar",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  approveAdminDriverController
);

router.patch(
  "/:idConductor/pin",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  setDriverPinAdminController
);

export default router;

