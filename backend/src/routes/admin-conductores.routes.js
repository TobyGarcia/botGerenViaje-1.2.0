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

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  listAdminDriversController
);

router.post(
  "/",
  createAdminDriverController
);

router.patch(
  "/:idConductor/estado",
  updateAdminDriverStatusController
);

export default router;