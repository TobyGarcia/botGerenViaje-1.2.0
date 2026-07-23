import { Router } from "express";

import {
  createTripController,
  startTripController
} from "../controllers/viajes.controller.js";

const router = Router();

router.post(
    "/", 
    createTripController
);

router.post(
  "/:idViaje/iniciar",
  startTripController
);

export default router;