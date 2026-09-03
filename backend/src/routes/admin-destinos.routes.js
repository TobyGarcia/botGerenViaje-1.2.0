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
  requireAdminSession,
  requireAdminRoles,
  ROLES_SUPERVISOR_Y_SUPERIOR
} from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  listAdminDestinationsController
);

router.post(
  "/",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
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
