import {
  Router
} from "express";

import {
  getAdminTripLocationDetailController,
  listAdminTripLocationsController
} from "../controllers/admin-ubicaciones.controller.js";

import {
  requireAdminSession
} from "../middlewares/admin-auth.middleware.js";

const router =
  Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  listAdminTripLocationsController
);

router.get(
  "/:idViaje",
  getAdminTripLocationDetailController
);

export default router;