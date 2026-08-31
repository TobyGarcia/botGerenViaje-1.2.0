import { Router } from "express";
import {
  cancelTripController,
  createTripController,
  finishTripController,
  getActiveTripController,
  getTripByIdController,
  startTripController
} from "../controllers/viajes.controller.js";
import { registerIntermediatePointController } from "../controllers/ubicaciones.controller.js";

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

router.post(
  "/:idViaje/cancelar",
  cancelTripController
);

router.post(
  "/:idViaje/punto-intermedio",
  registerIntermediatePointController
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
