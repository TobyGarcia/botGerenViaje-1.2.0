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

const router = Router();

router.use(
  requireAdminSession
);

router.get(
  "/",
  listAdminDestinationsController
);

router.post(
  "/",
  createAdminDestinationController
);

router.patch(
  "/:idDestino/estado",
  updateAdminDestinationStatusController
);

router.patch(
  "/:idDestino",
  updateAdminDestinationController
);

export default router;
