import { databasePool } from "../database/pool.js";
import { generateManejoComentadoPDF, saveEvaluationPDFLocally } from "./manejo-comentado-pdf.service.js";
import { getTelegramBot } from "../bot/bot.js";
import { findTelegramUserByConductorId } from "./telegram-user.service.js";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendCourseNotificationToTelegramGroups({ titulo, fechaCursoOral, fechaEvaluacionInicio, fechaEvaluacionFin, idConductores = [], notas = "" }) {
  try {
    const bot = getTelegramBot();
    if (!bot) return;

    const groupIds = new Set();
    if (process.env.TELEGRAM_GROUP_ID) groupIds.add(process.env.TELEGRAM_GROUP_ID);
    if (process.env.TELEGRAM_SUPERVISOR_CHAT_ID) groupIds.add(process.env.TELEGRAM_SUPERVISOR_CHAT_ID);

    try {
      const groupRes = await databasePool.query(
        `SELECT DISTINCT telegram_group_id FROM accesos_supervisor_telegram WHERE telegram_group_id IS NOT NULL`
      );
      groupRes.rows.forEach((r) => {
        if (r.telegram_group_id) groupIds.add(String(r.telegram_group_id));
      });
    } catch {
      // Ignorar errores de consulta DB
    }

    const htmlMsg = `🚗 <b>NUEVO CURSO DE MANEJO COMENTADO PROGRAMADO</b>\n\n` +
      `📌 <b>Título:</b> ${escapeHtml(titulo)}\n` +
      `📅 <b>Curso Oral:</b> ${fechaCursoOral}\n` +
      `🗓 <b>Evaluación Práctica:</b> del ${fechaEvaluacionInicio} al ${fechaEvaluacionFin}\n` +
      `👥 <b>Conductores Asignados:</b> ${idConductores.length} integrante(s)\n` +
      (notas ? `📝 <b>Notas:</b> ${escapeHtml(notas)}\n` : "") +
      `\nPor favor estar atentos a las indicaciones del instructor.`;

    for (const chatId of groupIds) {
      try {
        await bot.telegram.sendMessage(chatId, htmlMsg, { parse_mode: "HTML" });
      } catch (err) {
        console.error(`Error enviando notificación de curso al grupo Telegram (${chatId}):`, err.message);
      }
    }
  } catch (botErr) {
    console.warn("No fue posible enviar notificación de curso a Telegram:", botErr.message);
  }
}


// Calcula estado de vigencia considerando la regla semestral (6 meses = 180 días)
function calculateValidityStatus(fechaManejoComentado) {
  if (!fechaManejoComentado) {
    return {
      estado: "SIN_REGISTRO",
      fechaVencimiento: null,
      diasParaVencer: null
    };
  }

  let evalDate;
  if (fechaManejoComentado instanceof Date) {
    evalDate = new Date(fechaManejoComentado.getTime());
  } else {
    const rawStr = String(fechaManejoComentado).trim();
    const dateMatch = rawStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      const [y, m, d] = dateMatch[0].split("-").map(Number);
      evalDate = new Date(y, m - 1, d);
    } else {
      evalDate = new Date(rawStr);
    }
  }

  if (isNaN(evalDate.getTime())) {
    return {
      estado: "SIN_REGISTRO",
      fechaVencimiento: null,
      diasParaVencer: null
    };
  }

  const expiryDate = new Date(evalDate);
  expiryDate.setMonth(expiryDate.getMonth() + 6);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  const diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let estado = "VIGENTE";
  if (diasParaVencer < 0) {
    estado = "VENCIDO";
  } else if (diasParaVencer <= 30) {
    estado = "PROXIMO_A_VENCER";
  }

  const yyyy = expiryDate.getFullYear();
  const mm = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const dd = String(expiryDate.getDate()).padStart(2, "0");

  return {
    estado,
    fechaVencimiento: `${yyyy}-${mm}-${dd}`,
    diasParaVencer
  };
}


export async function listDriversManejoComentado({ search = "", status = "TODOS" } = {}) {
  const normalizedSearch = String(search).trim();
  const values = [];
  const conditions = ["c.activo = TRUE"];

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    conditions.push(`(c.nombre ILIKE $${values.length} OR c.empresa ILIKE $${values.length} OR c.licencia_numero ILIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await databasePool.query(
    `
      SELECT
        c.id_conductores,
        c.nombre,
        c.empresa,
        c.telefono,
        c.licencia_numero,
        c.tipo_licencia,
        COALESCE(
          c.fecha_manejo_comentado,
          (
            SELECT DATE(e.fecha_evaluacion)
            FROM evaluaciones_manejo_comentado e
            WHERE e.id_conductores = c.id_conductores AND e.estado_evaluacion = 'APROBADO'
            ORDER BY e.fecha_evaluacion DESC
            LIMIT 1
          )
        ) AS fecha_manejo_comentado,
        (
          SELECT json_build_object(
            'calificacion', e.calificacion,
            'comentarios', e.comentarios,
            'documento_url', e.documento_url,
            'fecha_evaluacion', e.fecha_evaluacion
          )
          FROM evaluaciones_manejo_comentado e
          WHERE e.id_conductores = c.id_conductores
          ORDER BY e.fecha_evaluacion DESC
          LIMIT 1
        ) AS ultima_evaluacion
      FROM conductores c
      ${whereClause}
      ORDER BY fecha_manejo_comentado ASC NULLS FIRST, c.nombre ASC
    `,
    values
  );

  const rows = result.rows.map((row) => {
    const validity = calculateValidityStatus(row.fecha_manejo_comentado);
    return {
      ...row,
      estado_vigencia: validity.estado,
      fecha_vencimiento: validity.fechaVencimiento,
      dias_para_vencer: validity.diasParaVencer
    };
  });

  if (status !== "TODOS") {
    return rows.filter((r) => r.estado_vigencia === status);
  }

  return rows;
}

export async function getExpiringManejoComentadoSummary() {
  const drivers = await listDriversManejoComentado({ search: "", status: "TODOS" });
  const expiring = drivers.filter(
    (d) => d.estado_vigencia === "PROXIMO_A_VENCER" || d.estado_vigencia === "VENCIDO" || d.estado_vigencia === "SIN_REGISTRO"
  );

  return {
    total_expiring: expiring.length,
    vencidos_count: expiring.filter((d) => d.estado_vigencia === "VENCIDO" || d.estado_vigencia === "SIN_REGISTRO").length,
    proximos_count: expiring.filter((d) => d.estado_vigencia === "PROXIMO_A_VENCER").length,
    items: expiring.slice(0, 10)
  };
}

export async function scheduleManejoComentadoCourse({
  titulo,
  fechaCursoOral,
  fechaEvaluacionInicio,
  fechaEvaluacionFin,
  idInstructor,
  idProgramador,
  idConductores = [],
  notas = ""
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const courseRes = await client.query(
      `
        INSERT INTO programacion_cursos_manejo_comentado (
          titulo,
          fecha_curso_oral,
          fecha_evaluacion_inicio,
          fecha_evaluacion_fin,
          id_usuario_instructor,
          id_usuario_programador,
          estado,
          notas
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'PROGRAMADO', $7)
        RETURNING *
      `,
      [titulo, fechaCursoOral, fechaEvaluacionInicio, fechaEvaluacionFin, idInstructor || null, idProgramador || null, notas]
    );

    const curso = courseRes.rows[0];

    if (idConductores.length > 0) {
      for (const idConductor of idConductores) {
        await client.query(
          `
            INSERT INTO evaluaciones_manejo_comentado (
              id_curso,
              id_conductores,
              id_usuario_evaluador,
              estado_evaluacion
            )
            VALUES ($1, $2, $3, 'PENDIENTE')
          `,
          [curso.id_curso, idConductor, idInstructor || null]
        );
      }
    }

    await client.query("COMMIT");

    // Notificar al grupo de viaje o avisos mediante Telegram Bot
    await sendCourseNotificationToTelegramGroups({
      titulo,
      fechaCursoOral,
      fechaEvaluacionInicio,
      fechaEvaluacionFin,
      idConductores,
      notas
    });

    return curso;


    return curso;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function renewManejoComentadoDirect({
  idConductor,
  fechaEvaluacion,
  calificacion = 100,
  comentarios = "Renovación directa registrada desde panel admin",
  idEvaluador = null,
  estadoEvaluacion = "APROBADO",
  rubrica = {}
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const conductorRes = await client.query(
      `SELECT id_conductores, nombre, empresa FROM conductores WHERE id_conductores = $1 LIMIT 1`,
      [idConductor]
    );

    const conductor = conductorRes.rows[0];
    if (!conductor) throw new Error("Conductor no encontrado.");

    const evaluacionRes = await client.query(
      `
        INSERT INTO evaluaciones_manejo_comentado (
          id_conductores,
          id_usuario_evaluador,
          fecha_evaluacion,
          calificacion,
          estado_evaluacion,
          comentarios,
          rubrica
        )
        VALUES ($1, $2, COALESCE($3::timestamptz, CURRENT_TIMESTAMP), $4, $5, $6, $7)
        RETURNING *
      `,
      [idConductor, idEvaluador, fechaEvaluacion || null, calificacion, estadoEvaluacion, comentarios, JSON.stringify(rubrica)]
    );

    const evalRow = evaluacionRes.rows[0];

    // Generar PDF histórico
    const pdf = generateManejoComentadoPDF({
      id_evaluacion: evalRow.id_evaluacion,
      conductor_nombre: conductor.nombre,
      empresa: conductor.empresa,
      fecha_evaluacion: evalRow.fecha_evaluacion,
      calificacion: evalRow.calificacion,
      estado_evaluacion: evalRow.estado_evaluacion,
      comentarios: evalRow.comentarios,
      rubrica: evalRow.rubrica
    });

    const pdfUrl = saveEvaluationPDFLocally(pdf);
    if (pdfUrl) {
      await client.query(
        `UPDATE evaluaciones_manejo_comentado SET documento_url = $1 WHERE id_evaluacion = $2`,
        [pdfUrl, evalRow.id_evaluacion]
      );
      evalRow.documento_url = pdfUrl;
    }

    if (estadoEvaluacion === "APROBADO") {
      const fechaActualizacion = fechaEvaluacion ? fechaEvaluacion.slice(0, 10) : new Date().toISOString().slice(0, 10);
      await client.query(
        `UPDATE conductores SET fecha_manejo_comentado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_conductores = $2`,
        [fechaActualizacion, idConductor]
      );
    }

    await client.query("COMMIT");

    // Notificación al conductor
    await notifyDriverResult(conductor, evalRow, estadoEvaluacion, calificacion, comentarios);

    return evalRow;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function submitInstructorEvaluation({
  idEvaluacion = null,
  idCurso = null,
  idConductor,
  calificacion,
  comentarios = "",
  rubrica = {},
  idInstructor = null,
  nombreInstructor = ""
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    let evaluadorNombreText = String(nombreInstructor || "").trim();
    if (!evaluadorNombreText && idInstructor) {
      const instRes = await client.query(
        `SELECT nombre FROM usuarios_admin WHERE id_usuarios_admin = $1 LIMIT 1`,
        [idInstructor]
      );
      if (instRes.rows[0]?.nombre) {
        evaluadorNombreText = instRes.rows[0].nombre;
      }
    }

    const conductorRes = await client.query(
      `SELECT id_conductores, nombre, empresa FROM conductores WHERE id_conductores = $1 LIMIT 1`,
      [idConductor]
    );

    const conductor = conductorRes.rows[0];
    if (!conductor) throw new Error("El conductor no existe.");

    const estadoEvaluacion = Number(calificacion) >= 70 ? "APROBADO" : "REPROBADO";

    let evalRow;

    if (idEvaluacion) {
      const updateRes = await client.query(
        `
          UPDATE evaluaciones_manejo_comentado
          SET
            calificacion = $1,
            estado_evaluacion = $2,
            comentarios = $3,
            rubrica = $4,
            id_usuario_evaluador = COALESCE($5, id_usuario_evaluador),
            fecha_evaluacion = CURRENT_TIMESTAMP,
            actualizado_en = CURRENT_TIMESTAMP
          WHERE id_evaluacion = $6
          RETURNING *
        `,
        [calificacion, estadoEvaluacion, comentarios, JSON.stringify(rubrica), idInstructor, idEvaluacion]
      );
      evalRow = updateRes.rows[0];
    } else {
      const insertRes = await client.query(
        `
          INSERT INTO evaluaciones_manejo_comentado (
            id_curso,
            id_conductores,
            id_usuario_evaluador,
            calificacion,
            estado_evaluacion,
            comentarios,
            rubrica
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [idCurso || null, idConductor, idInstructor || null, calificacion, estadoEvaluacion, comentarios, JSON.stringify(rubrica)]
      );
      evalRow = insertRes.rows[0];
    }

    // Generar PDF y guardar localmente
    const pdf = generateManejoComentadoPDF({
      id_evaluacion: evalRow.id_evaluacion,
      conductor_nombre: conductor.nombre,
      empresa: conductor.empresa,
      evaluador_nombre: evaluadorNombreText || "Instructor Autorizado",
      fecha_evaluacion: evalRow.fecha_evaluacion,
      calificacion: evalRow.calificacion,
      estado_evaluacion: evalRow.estado_evaluacion,
      comentarios: evalRow.comentarios,
      rubrica: evalRow.rubrica
    });


    const pdfUrl = saveEvaluationPDFLocally(pdf);
    if (pdfUrl) {
      await client.query(
        `UPDATE evaluaciones_manejo_comentado SET documento_url = $1 WHERE id_evaluacion = $2`,
        [pdfUrl, evalRow.id_evaluacion]
      );
      evalRow.documento_url = pdfUrl;
    }

    if (estadoEvaluacion === "APROBADO") {
      const hoy = new Date().toISOString().slice(0, 10);
      await client.query(
        `UPDATE conductores SET fecha_manejo_comentado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_conductores = $2`,
        [hoy, idConductor]
      );
    }

    await client.query("COMMIT");

    // Notificación al conductor
    await notifyDriverResult(conductor, evalRow, estadoEvaluacion, calificacion, comentarios);

    return evalRow;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function notifyDriverResult(conductor, evalRow, estadoEvaluacion, calificacion, comentarios) {
  try {
    const telegramUser = await findTelegramUserByConductorId(conductor.id_conductores);
    const bot = getTelegramBot();

    if (bot && telegramUser?.telegram_user_id) {
      if (estadoEvaluacion === "APROBADO") {
        const msg = `🎉 *¡FELICITACIONES, ${conductor.nombre.toUpperCase()}!*\n\n` +
          `Has APROBADO satisfactoriamente tu evaluación de *Manejo Comentado*.\n\n` +
          `⭐ *Puntaje:* ${calificacion} / 100\n` +
          `💬 *Comentarios del evaluador:* ${comentarios || "Desempeño adecuado."}\n` +
          `📅 *Vigencia:* 6 meses a partir de hoy.`;

        await bot.telegram.sendMessage(telegramUser.telegram_user_id, msg, { parse_mode: "Markdown" }).catch(() => {});
      } else {
        const msg = `⚠️ *RESULTADO DE EVALUACIÓN DE MANEJO COMENTADO*\n\n` +
          `Hola ${conductor.nombre}, tu evaluación ha sido registrada como *REPROBADA*.\n\n` +
          `📊 *Puntaje obtenido:* ${calificacion} / 100\n` +
          `💬 *Comentarios del evaluador:* ${comentarios || "Se requieren reforzar hábitos de conducción segura."}\n\n` +
          `Tu instructor/evaluador se coordinará contigo para reprogramar tu evaluación.`;

        await bot.telegram.sendMessage(telegramUser.telegram_user_id, msg, { parse_mode: "Markdown" }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("No fue posible enviar mensaje al conductor:", err.message);
  }
}

export async function listScheduledCourses() {
  const result = await databasePool.query(`
    SELECT
      p.id_curso,
      p.titulo,
      p.fecha_curso_oral,
      p.fecha_evaluacion_inicio,
      p.fecha_evaluacion_fin,
      p.estado,
      p.notas,
      u_inst.nombre AS instructor_nombre,
      u_prog.nombre AS programador_nombre,
      COUNT(e.id_evaluacion)::INTEGER AS total_participantes,
      COUNT(CASE WHEN e.estado_evaluacion = 'APROBADO' THEN 1 END)::INTEGER AS aprobados,
      COUNT(CASE WHEN e.estado_evaluacion = 'REPROBADO' THEN 1 END)::INTEGER AS reprobados,
      COUNT(CASE WHEN e.estado_evaluacion = 'PENDIENTE' THEN 1 END)::INTEGER AS pendientes
    FROM programacion_cursos_manejo_comentado p
    LEFT JOIN usuarios_admin u_inst ON u_inst.id_usuarios_admin = p.id_usuario_instructor
    LEFT JOIN usuarios_admin u_prog ON u_prog.id_usuarios_admin = p.id_usuario_programador
    LEFT JOIN evaluaciones_manejo_comentado e ON e.id_curso = p.id_curso
    GROUP BY p.id_curso, u_inst.nombre, u_prog.nombre
    ORDER BY p.fecha_curso_oral DESC
  `);

  return result.rows;
}

export async function getCourseDetails(idCurso) {
  const courseRes = await databasePool.query(
    `SELECT * FROM programacion_cursos_manejo_comentado WHERE id_curso = $1 LIMIT 1`,
    [idCurso]
  );
  const course = courseRes.rows[0];
  if (!course) throw new Error("Curso no encontrado.");

  const partRes = await databasePool.query(
    `
      SELECT
        e.id_evaluacion,
        e.id_conductores,
        e.calificacion,
        e.estado_evaluacion,
        e.comentarios,
        e.documento_url,
        e.fecha_evaluacion,
        c.nombre AS conductor_nombre,
        c.empresa,
        c.licencia_numero
      FROM evaluaciones_manejo_comentado e
      INNER JOIN conductores c ON c.id_conductores = e.id_conductores
      WHERE e.id_curso = $1
      ORDER BY c.nombre ASC
    `,
    [idCurso]
  );

  return {
    ...course,
    participantes: partRes.rows
  };
}
