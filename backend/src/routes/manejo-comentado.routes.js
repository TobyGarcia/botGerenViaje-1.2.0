import { Router } from "express";
import {
  listDriversManejoComentadoController,
  getExpiringSummaryController,
  scheduleCourseController,
  renewDirectController,
  submitInstructorEvaluationController,
  listScheduledCoursesController,
  getCourseDetailsController,
  updateDriverManejoComentadoController,
  batchUpdateDriversManejoComentadoController
} from "../controllers/manejo-comentado.controller.js";
import { requireAdminSession, requireAdminRoles, ROLES_SUPERVISOR_Y_SUPERIOR } from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(requireAdminSession);

// Resumen rápido de expirados para el dashboard
router.get("/resumen-expirados", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), getExpiringSummaryController);

// Listado de conductores con estatus de Manejo Comentado
router.get("/conductores", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), listDriversManejoComentadoController);

// Ingesta por lote / batch desde plantilla Excel
router.post("/conductores/batch", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), batchUpdateDriversManejoComentadoController);

// Edición de datos de manejo comentado y licencia del conductor
router.put("/conductores/:idConductor", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), updateDriverManejoComentadoController);
router.patch("/conductores/:idConductor", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), updateDriverManejoComentadoController);

// Programar curso de manejo comentado
router.post("/cursos", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), scheduleCourseController);

// Listar cursos programados
router.get("/cursos", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), listScheduledCoursesController);
router.get("/cursos/:idCurso", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), getCourseDetailsController);

// Renovación directa desde el panel administrativo
router.post("/renovar", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), renewDirectController);

// Registro/Calificación de evaluación por parte del Instructor (App Web /evaluacion)
router.post("/evaluar", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), submitInstructorEvaluationController);

export default router;

