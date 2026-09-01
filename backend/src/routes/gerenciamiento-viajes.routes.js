import { Router } from "express";
import {
  createGerenciamientoController,
  getGerenciamientoByIdController,
  getGerenciamientoByViajeController,
  listGerenciamientosController,
  aprovarGerenciamientoController,
  registrarReporteHoraController
} from "../controllers/gerenciamiento-viajes.controller.js";

const router = Router();

router.post("/", createGerenciamientoController);
router.get("/", listGerenciamientosController);
router.get("/:id", getGerenciamientoByIdController);
router.get("/viaje/:idViaje", getGerenciamientoByViajeController);
router.patch("/:id/aprobar", aprovarGerenciamientoController);
router.patch("/:id/reporte-hora", registrarReporteHoraController);

export default router;
