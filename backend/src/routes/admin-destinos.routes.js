import {
  Router
} from "express";

import {
  createAdminDestinationController,
  listAdminDestinationsController,
  updateAdminDestinationController,
  updateAdminDestinationStatusController
} from "../controllers/admin-destinos.controller.js";

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
  listAdminDestinationsController
);

router.post(
  "/",
  requireAdminRoles("ADMINISTRADOR", "SUPERVISOR"),
  createAdminDestinationController
);

router.patch(
  "/:idDestino/estado",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminDestinationStatusController
);

router.patch(
  "/:idDestino",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminDestinationController
);

export default router;
