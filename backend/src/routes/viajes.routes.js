import { Router } from "express";
import { tripItemsController, tripOperationController, trailerInspectionController } from '../controllers/trip-operations.controller.js';
import { nativeCompletionController } from "../controllers/native-completion.controller.js";
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
import { offlinePermitsController, offlineSyncController } from "../controllers/offline-viajes.controller.js";

const router = Router();

router.use(requireActiveDriver);
router.get('/:idViaje/elementos', tripItemsController);
router.post('/:idViaje/elementos/eventos', tripOperationController);
router.get('/:idViaje/remolques/:trailerId/inspeccion', trailerInspectionController);
router.post("/:idViaje/cierre-nativo", nativeCompletionController);
router.get("/offline/permisos", offlinePermitsController);
router.post("/offline/sincronizar", offlineSyncController);

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
