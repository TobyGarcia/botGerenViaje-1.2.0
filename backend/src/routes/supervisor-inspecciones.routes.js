import { Router } from "express";
import { decideSupervisorInspectionController, getSupervisorInspectionController, listSupervisorInspectionsController } from "../controllers/supervisor-inspecciones.controller.js";
const router = Router();
router.get("/", listSupervisorInspectionsController);
router.get("/:idInspeccion", getSupervisorInspectionController);
router.patch("/:idInspeccion/decision", decideSupervisorInspectionController);
export default router;
