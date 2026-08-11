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
  listAdminVehiclesController
);

router.post(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  createAdminVehicleController
);

router.get("/:idVehiculo", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"), getAdminVehicleDetailController);
router.patch("/:idVehiculo", requireAdminRoles("ADMINISTRADOR"), updateAdminVehicleController);

router.get("/:idVehiculo/kilometraje", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"), getAdminVehicleMileageHistoryController);
router.get("/:idVehiculo/kilometraje/resumen", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"), getAdminVehicleMileageSummaryController);
router.post("/:idVehiculo/kilometraje", requireAdminRoles("ADMINISTRADOR"), createAdminVehicleMileageReadingController);
router.post("/:idVehiculo/kilometraje/correccion", requireAdminRoles("ADMINISTRADOR"), createAdminVehicleMileageReadingController);

router.patch(
  "/:idVehiculo/estado",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminVehicleStatusController
);

router.patch("/:idVehiculo/mantenimiento", requireAdminRoles("ADMINISTRADOR"), updateAdminVehicleMaintenanceController);

export default router;
