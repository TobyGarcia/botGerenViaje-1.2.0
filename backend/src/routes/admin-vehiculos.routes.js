import {
  Router
} from "express";

import {
  createAdminVehicleController,
  createAdminVehicleMileageReadingController,
  getAdminVehicleDetailController,
  getAdminVehicleMileageHistoryController,
  getAdminVehicleMileageSummaryController,
  listAdminVehiclesController,
  updateAdminVehicleMaintenanceController,
  updateAdminVehicleController,
  updateAdminVehicleStatusController
} from "../controllers/admin-vehiculos.controller.js";

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
  listAdminVehiclesController
);

router.post(
  "/",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  createAdminVehicleController
);

router.get("/:idVehiculo", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), getAdminVehicleDetailController);
router.patch("/:idVehiculo", requireAdminRoles("ADMINISTRADOR"), updateAdminVehicleController);

router.get("/:idVehiculo/kilometraje", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), getAdminVehicleMileageHistoryController);
router.get("/:idVehiculo/kilometraje/resumen", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), getAdminVehicleMileageSummaryController);
router.post("/:idVehiculo/kilometraje", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), createAdminVehicleMileageReadingController);
router.post("/:idVehiculo/kilometraje/correccion", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), createAdminVehicleMileageReadingController);

router.patch(
  "/:idVehiculo/estado",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminVehicleStatusController
);

router.patch("/:idVehiculo/mantenimiento", requireAdminRoles("ADMINISTRADOR"), updateAdminVehicleMaintenanceController);

export default router;
