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
  requireAdminSession
} from "../middlewares/admin-auth.middleware.js";
import { requireAdminRoles } from "../middlewares/admin-auth.middleware.js";

const router =
  Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"),
  listAdminTripsController
);

router.get(
  "/resumen",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "CONSULTA"),
  getAdminDashboardSummaryController
);

router.get(
  "/:idViaje",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"),
  getAdminTripController
);

router.delete(
  "/:idViaje",
  requireAdminRoles("ADMINISTRADOR"),
  deleteAdminTripController
);

export default router;
