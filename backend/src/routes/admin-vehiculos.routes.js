import {
  Router
} from "express";

import {
  createAdminVehicleController,
  createAdminVehicleMileageReadingController,
  getAdminVehicleMileageHistoryController,
  getAdminVehicleMileageSummaryController,
  listAdminVehiclesController,
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

router.get("/:idVehiculo/kilometraje", getAdminVehicleMileageHistoryController);
router.get("/:idVehiculo/kilometraje/resumen", getAdminVehicleMileageSummaryController);
router.post("/:idVehiculo/kilometraje", createAdminVehicleMileageReadingController);
router.post("/:idVehiculo/kilometraje/correccion", createAdminVehicleMileageReadingController);

router.patch(
  "/:idVehiculo/estado",
  updateAdminVehicleStatusController
);

export default router;
