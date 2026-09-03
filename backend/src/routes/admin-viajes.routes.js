import {
  Router
} from "express";

import {
  deleteAdminTripController,
  getAdminDashboardSummaryController,
  getAdminTripController,
  listAdminTripsController
} from "../controllers/admin-viajes.controller.js";

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
  listAdminTripsController
);

router.get(
  "/resumen",
  requireAdminRoles(ROLES_TODOS_OPERATIVOS),
  getAdminDashboardSummaryController
);

router.get(
  "/:idViaje",
  requireAdminRoles(ROLES_TODOS_OPERATIVOS),
  getAdminTripController
);

router.delete(
  "/:idViaje",
  requireAdminRoles("ADMINISTRADOR"),
  deleteAdminTripController
);

export default router;
