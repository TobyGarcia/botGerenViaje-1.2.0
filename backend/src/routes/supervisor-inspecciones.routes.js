import { Router } from "express";
import { assignSupervisorVehicleController, decideSupervisorInspectionController, getSupervisorInspectionController, listSupervisorAssignmentsController, listSupervisorInspectionsController } from "../controllers/supervisor-inspecciones.controller.js";
const router = Router();
router.get("/", listSupervisorInspectionsController);
router.get("/asignaciones", listSupervisorAssignmentsController);
router.post("/asignaciones", assignSupervisorVehicleController);
router.get("/:idInspeccion", getSupervisorInspectionController);
router.patch("/:idInspeccion/decision", decideSupervisorInspectionController);
export default router;
