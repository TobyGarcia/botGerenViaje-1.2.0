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

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  listAdminVehiclesController
);

router.post(
  "/",
  createAdminVehicleController
);

router.get("/:idVehiculo", getAdminVehicleDetailController);
router.patch("/:idVehiculo", updateAdminVehicleController);

router.get("/:idVehiculo/kilometraje", getAdminVehicleMileageHistoryController);
router.get("/:idVehiculo/kilometraje/resumen", getAdminVehicleMileageSummaryController);
router.post("/:idVehiculo/kilometraje", createAdminVehicleMileageReadingController);
router.post("/:idVehiculo/kilometraje/correccion", createAdminVehicleMileageReadingController);

router.patch(
  "/:idVehiculo/estado",
  updateAdminVehicleStatusController
);

router.patch("/:idVehiculo/mantenimiento", updateAdminVehicleMaintenanceController);

export default router;
