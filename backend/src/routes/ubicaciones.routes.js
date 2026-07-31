import { Router } from "express";

import {
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
  "/lote",
  registerTripLocationBatchController
);

export default router;
