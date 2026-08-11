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
import { requireAdminRoles } from "../middlewares/admin-auth.middleware.js";

const router =
  Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"),
  listAdminTripLocationsController
);

router.get(
  "/:idViaje",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"),
  getAdminTripLocationDetailController
);

export default router;
