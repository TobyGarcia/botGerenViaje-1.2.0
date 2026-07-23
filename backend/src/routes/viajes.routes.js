import { Router } from "express";
import {
  createTripController,
  finishTripController,
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

export default router;