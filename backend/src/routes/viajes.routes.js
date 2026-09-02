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
import { requireActiveDriver } from "../middlewares/driver-auth.middleware.js";

const router = Router();

router.use(requireActiveDriver);

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
