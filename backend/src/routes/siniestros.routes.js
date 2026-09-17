import { Router } from "express";
import {
  crearSiniestroController,
  listarSiniestrosController
} from "../controllers/siniestros.controller.js";
import { requireActiveDriver } from "../middlewares/driver-auth.middleware.js";

const router = Router();

router.post("/", requireActiveDriver, crearSiniestroController);
router.get("/", requireActiveDriver, listarSiniestrosController);

export default router;
