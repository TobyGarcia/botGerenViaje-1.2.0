import {
  Router
} from "express";

import {
  createAdminVehicleController,
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

router.patch(
  "/:idVehiculo/estado",
  updateAdminVehicleStatusController
);

export default router;