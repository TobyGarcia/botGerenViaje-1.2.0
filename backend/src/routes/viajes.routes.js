import { Router } from "express";
import {
  createTripController,
  finishTripController,
  getActiveTripController,
  getTripByIdController,
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

router.post(
  "/:idViaje/finalizar",
  finishTripController
);

router.get(
  "/activo",
  getActiveTripController
);

router.get(
  "/:idViaje",
  getTripByIdController
);

export default router;