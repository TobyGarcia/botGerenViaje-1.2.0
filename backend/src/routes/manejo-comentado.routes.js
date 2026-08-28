import { Router } from "express";
import {
  listDriversManejoComentadoController,
  getExpiringSummaryController,
  scheduleCourseController,
  renewDirectController,
  submitInstructorEvaluationController,
  listScheduledCoursesController,
  getCourseDetailsController
} from "../controllers/manejo-comentado.controller.js";
import { requireAdminSession, requireAdminRoles } from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(requireAdminSession);

// Resumen rápido de expirados para el dashboard (accesible para Admin, Supervisor e Instructor)
router.get("/resumen-expirados", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), getExpiringSummaryController);

// Listado de conductores con estatus de Manejo Comentado
router.get("/conductores", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), listDriversManejoComentadoController);

// Programar curso de manejo comentado (Exclusivo o prioritario para Instructor y Supervisor)
router.post("/cursos", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), scheduleCourseController);

// Listar cursos programados
router.get("/cursos", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), listScheduledCoursesController);
router.get("/cursos/:idCurso", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), getCourseDetailsController);

// Renovación directa desde el panel administrativo
router.post("/renovar", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), renewDirectController);

// Registro/Calificación de evaluación por parte del Instructor (App Web /evaluacion)
router.post("/evaluar", requireAdminRoles("ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"), submitInstructorEvaluationController);

export default router;
