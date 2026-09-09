import { Router } from "express";
import { requireOptionalAdminSession } from "../middlewares/admin-auth.middleware.js";
import {
  assignSupervisorVehicleController,
  decideSupervisorDriverController,
  decideSupervisorInspectionController,
  getSupervisorInspectionController,
  listPendingSupervisorDriversController,
  listSupervisorAssignmentsController,
  listSupervisorInspectionsController
} from "../controllers/supervisor-inspecciones.controller.js";

const router = Router();
router.use(requireOptionalAdminSession);

router.get("/", listSupervisorInspectionsController);
router.get("/asignaciones", listSupervisorAssignmentsController);
router.post("/asignaciones", assignSupervisorVehicleController);
router.get("/conductores-pendientes", listPendingSupervisorDriversController);
router.patch("/conductores/:idConductor/aprobar", decideSupervisorDriverController);
router.get("/:idInspeccion", getSupervisorInspectionController);
router.patch("/:idInspeccion/decision", decideSupervisorInspectionController);
export default router;
