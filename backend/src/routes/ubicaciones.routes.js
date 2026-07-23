import { Router } from "express";

import {
  registerTripLocationController
} from "../controllers/ubicaciones.controller.js";

const router = Router({
  mergeParams: true
});

router.post(
  "/",
  registerTripLocationController
);

export default router;