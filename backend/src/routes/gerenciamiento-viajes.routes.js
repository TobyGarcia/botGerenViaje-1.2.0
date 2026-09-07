import { Router } from "express";
import {
  createGerenciamientoController,
  getGerenciamientoByIdController,
  getGerenciamientoByViajeController,
  listGerenciamientosController,
  aprovarGerenciamientoController,
  registrarReporteHoraController,
  downloadGerenciamientoPdfController,
  previewGerenciamientoPdfController
} from "../controllers/gerenciamiento-viajes.controller.js";

const router = Router();

router.post("/", createGerenciamientoController);
router.get("/", listGerenciamientosController);
router.get("/:id", getGerenciamientoByIdController);
router.get("/:id/pdf", downloadGerenciamientoPdfController);
router.get("/:id/vista-previa-pdf", previewGerenciamientoPdfController);
router.get("/viaje/:idViaje", getGerenciamientoByViajeController);
router.patch("/:id/aprobar", aprovarGerenciamientoController);
router.patch("/:id/decision", aprovarGerenciamientoController);
router.patch("/:id/reporte-hora", registrarReporteHoraController);

export default router;
