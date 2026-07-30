import {
  Router
} from "express";

import {
  deleteAdminTripController,
  getAdminTripController,
  listAdminTripsController
} from "../controllers/admin-viajes.controller.js";

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
  listAdminTripsController
);

router.get(
  "/:idViaje",
  getAdminTripController
);

router.delete(
  "/:idViaje",
  deleteAdminTripController
);

export default router;