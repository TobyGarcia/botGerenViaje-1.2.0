import {
  Router
} from "express";

import {
  createAdminDriverController,
  listAdminDriversController,
  updateAdminDriverStatusController
} from "../controllers/admin-conductores.controller.js";

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
  requireAdminRoles("ADMINISTRADOR"),
  listAdminDriversController
);

router.post(
  "/",
  requireAdminRoles("ADMINISTRADOR"),
  createAdminDriverController
);

router.patch(
  "/:idConductor/estado",
  requireAdminRoles("ADMINISTRADOR"),
  updateAdminDriverStatusController
);

export default router;
