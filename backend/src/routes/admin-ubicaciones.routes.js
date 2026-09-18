import {
  Router
} from "express";

import {
  getAdminTripLocationDetailController,
  listAdminTripLocationsController,
  getAdminActiveTripsLiveController
} from "../controllers/admin-ubicaciones.controller.js";

import {
  requireAdminSession,
  requireAdminRoles,
  ROLES_TODOS_OPERATIVOS
} from "../middlewares/admin-auth.middleware.js";

const router =
  Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles(ROLES_TODOS_OPERATIVOS),
  listAdminTripLocationsController
);

router.get(
  "/monitoreo-activo",
  requireAdminRoles(ROLES_TODOS_OPERATIVOS),
  getAdminActiveTripsLiveController
);

router.get(
  "/:idViaje",
  requireAdminRoles(ROLES_TODOS_OPERATIVOS),
  getAdminTripLocationDetailController
);

export default router;
