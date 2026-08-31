import { Router } from "express";

import {
  registerIntermediatePointController,
  registerTripLocationBatchController,
  registerTripLocationController
} from "../controllers/ubicaciones.controller.js";

const router = Router({
  mergeParams: true
});

router.post(
  "/",
  registerTripLocationController
);

router.post(
  "/punto-intermedio",
  registerIntermediatePointController
);

router.post(
  "/lote",
  registerTripLocationBatchController
);

export default router;
