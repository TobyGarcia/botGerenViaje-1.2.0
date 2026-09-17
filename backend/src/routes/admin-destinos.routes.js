import {
  Router
} from "express";

import {
  createAdminDestinationController,
  deleteAdminDestinationController,
  importAdminDestinationsController,
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

router.post(
  "/importar",
  requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),
  importAdminDestinationsController
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

router.delete(
  "/:idDestino",
  requireAdminRoles("ADMINISTRADOR"),
  deleteAdminDestinationController
);

export default router;
