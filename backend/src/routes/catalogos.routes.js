import { Router } from "express";

import {
  addLugar,
  listConductores,
  listEstadosViaje,
  listLugares,
  listVehiculos
} from "../controllers/catalogos.controller.js";

const router = Router();

router.get(
  "/conductores",
  listConductores
);

router.get(
  "/vehiculos",
  listVehiculos
);

router.get(
  "/lugares",
  listLugares
);

router.post(
  "/lugares",
  addLugar
);

router.get(
  "/estados-viaje",
  listEstadosViaje
);

export default router;