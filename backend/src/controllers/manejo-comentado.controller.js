import {
  listDriversManejoComentado,
  getExpiringManejoComentadoSummary,
  scheduleManejoComentadoCourse,
  renewManejoComentadoDirect,
  submitInstructorEvaluation,
  listScheduledCourses,
  getCourseDetails
} from "../services/manejo-comentado.service.js";

export async function listDriversManejoComentadoController(req, res) {
  try {
    const { search, status } = req.query;
    const data = await listDriversManejoComentado({ search, status });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getExpiringSummaryController(req, res) {
  try {
    const data = await getExpiringManejoComentadoSummary();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function scheduleCourseController(req, res) {
  try {
    const { titulo, fechaCursoOral, fechaEvaluacionInicio, fechaEvaluacionFin, idInstructor, idConductores, notas } = req.body;
    const idProgramador = req.adminUser?.id_usuarios_admin;

    if (!titulo || !fechaCursoOral || !fechaEvaluacionInicio || !fechaEvaluacionFin) {
      return res.status(400).json({ success: false, message: "Todos los campos de fecha y título son obligatorios." });
    }

    const data = await scheduleManejoComentadoCourse({
      titulo,
      fechaCursoOral,
      fechaEvaluacionInicio,
      fechaEvaluacionFin,
      idInstructor,
      idProgramador,
      idConductores,
      notas
    });

    return res.status(201).json({ success: true, data, message: "Curso de manejo comentado programado exitosamente." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function renewDirectController(req, res) {
  try {
    const { idConductor, fechaEvaluacion, calificacion, comentarios, estadoEvaluacion, rubrica } = req.body;
    const idEvaluador = req.adminUser?.id_usuarios_admin;

    if (!idConductor) {
      return res.status(400).json({ success: false, message: "El ID del conductor es requerido." });
    }

    const data = await renewManejoComentadoDirect({
      idConductor,
      fechaEvaluacion,
      calificacion: Number(calificacion || 100),
      comentarios,
      idEvaluador,
      estadoEvaluacion: estadoEvaluacion || "APROBADO",
      rubrica
    });

    return res.status(200).json({ success: true, data, message: "Manejo comentado renovado exitosamente." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function submitInstructorEvaluationController(req, res) {
  try {
    const { idEvaluacion, idCurso, idConductor, calificacion, comentarios, rubrica } = req.body;
    const idInstructor = req.adminUser?.id_usuarios_admin;

    if (!idConductor || calificacion === undefined || calificacion === null) {
      return res.status(400).json({ success: false, message: "El conductor y la calificación son obligatorios." });
    }

    const data = await submitInstructorEvaluation({
      idEvaluacion,
      idCurso,
      idConductor,
      calificacion: Number(calificacion),
      comentarios,
      rubrica,
      idInstructor
    });

    return res.status(200).json({ success: true, data, message: "Evaluación guardada y procesada correctamente." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function listScheduledCoursesController(req, res) {
  try {
    const data = await listScheduledCourses();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getCourseDetailsController(req, res) {
  try {
    const { idCurso } = req.params;
    const data = await getCourseDetails(idCurso);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
