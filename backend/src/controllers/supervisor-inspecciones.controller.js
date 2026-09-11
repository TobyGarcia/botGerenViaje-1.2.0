import { approveInspection, getAdminInspection, listPendingInspections, storeInspectionPdf, updateInspectionSharePointDetails } from "../services/inspecciones.service.js";
import { buildInspectionPdf } from "../services/inspeccion-pdf.service.js";
import { cancelTrip } from "../services/viajes.service.js";
import { findTelegramUserByConductorId } from "../services/telegram-user.service.js";
import { sendDriverInspectionNotification } from "../bot/bot.js";
import { getSupervisorAccess } from "../services/supervisor-telegram.service.js";
import { validateTelegramInitData } from "../utils/telegram-init-data.js";
import { uploadInspectionPdfToSharePoint } from "../services/sharepoint.service.js";
import { listAdminDrivers, assignVehicleToDriver, approveAdminDriver } from "../services/admin-conductores.service.js";
import { getVehiculos } from "../services/catalogos.service.js";
import { databasePool } from "../database/pool.js";
import { sendDriverPinNotification, sendDriverApprovalNotification } from "../bot/bot.js";

async function requireSupervisor(request) {
  const allowedRoles = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"];
  if (request.adminUser) {
    if (!request.adminUser.activo || !allowedRoles.includes(request.adminUser.rol)) {
      throw Object.assign(new Error("Tu cuenta no tiene permisos de supervisión."), { statusCode: 403 });
    }
    return request.adminUser;
  }
  const telegramData = validateTelegramInitData(request.get("X-Telegram-Init-Data") || "", { botToken: process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN, maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 3600) });
  const access = await getSupervisorAccess(telegramData.user.id);
  if (!access?.invited || !access?.registered || !access?.confirmed || !access?.user?.activo || !allowedRoles.includes(access.user.rol)) throw Object.assign(new Error("Tu cuenta de supervisor no está autorizada o aún no confirmó el correo."), { statusCode: 403 });
  return access.user;
}
export async function listSupervisorInspectionsController(request, response) {
  try { await requireSupervisor(request); return response.json({ success: true, data: (await listPendingInspections()).filter((item) => item.estado === "PENDIENTE_APROBACION") }); }
  catch (error) { return response.status(error.statusCode || 401).json({ success: false, message: error.message }); }
}
export async function getSupervisorInspectionController(request, response) {
  try { await requireSupervisor(request); const data = await getAdminInspection(Number(request.params.idInspeccion)); return data ? response.json({ success: true, data }) : response.status(404).json({ success: false, message: "Inspección no encontrada." }); }
  catch (error) { return response.status(error.statusCode || 401).json({ success: false, message: error.message }); }
}
export async function decideSupervisorInspectionController(request, response) {
  try {
    const supervisor = await requireSupervisor(request);
    const approved = request.body?.aprobada;
    const signature = String(request.body?.firma || "");
    const comment = String(request.body?.comentario || "").trim();
    if (typeof approved !== "boolean") return response.status(400).json({ success: false, message: "La decisión no es válida." });
    if (!signature.startsWith("data:image/png;base64,")) return response.status(400).json({ success: false, message: "La firma del supervisor es obligatoria." });
    const idInspeccion = Number(request.params.idInspeccion);
    const data = await approveInspection({ idInspeccion, idUsuarioAdmin: supervisor.id_usuarios_admin, approved, comentario: comment, firmaSupervisor: signature });
    if (!data) return response.status(409).json({ success: false, message: "La inspección ya fue atendida." });
    let trip;
    let sharepointResult = null;
    if (approved) {
      const detail = await getAdminInspection(idInspeccion);
      const pdf = buildInspectionPdf(detail);
      await storeInspectionPdf({ idInspeccion, nombre: pdf.nombre, document: pdf.buffer });
      
      // Intentar subir a SharePoint
      sharepointResult = await uploadInspectionPdfToSharePoint({
        folio: detail.folio,
        filename: pdf.nombre,
        pdfBuffer: pdf.buffer,
        date: detail.creado_en || detail.aprobado_en
      });
      if (sharepointResult.success && sharepointResult.webUrl) {
        await updateInspectionSharePointDetails({ idInspeccion, webUrl: sharepointResult.webUrl, itemId: sharepointResult.itemId });
      }

      trip = { idViaje: detail.id_viajes, folio: detail.folio, vehiculo: detail.vehiculo, conductor: detail.conductor };
    } else trip = await cancelTrip({ idViaje: data.id_viajes, observaciones: `Inspección vehicular rechazada.${comment ? ` Motivo: ${comment}` : ""}` });
    const telegramUser = await findTelegramUserByConductorId(data.id_conductores);
    await sendDriverInspectionNotification({ telegramUserId: telegramUser?.telegram_user_id, approved, trip, comment });
    return response.json({
      success: true,
      data: { ...data, viaje: trip, sharepoint: sharepointResult },
      message: approved ? "Inspección aprobada y PDF generado." : "Inspección rechazada y viaje cancelado."
    });
  } catch (error) { return response.status(error.statusCode || 500).json({ success: false, message: error.message || "No fue posible registrar la decisión." }); }
}

export async function listSupervisorAssignmentsController(request, response) {
  try {
    await requireSupervisor(request);
    const [conductores, vehiculos] = await Promise.all([
      listAdminDrivers({ status: "ACTIVOS" }),
      getVehiculos()
    ]);
    return response.json({
      success: true,
      data: {
        conductores,
        vehiculos
      }
    });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message || "No fue posible consultar las asignaciones." });
  }
}

export async function assignSupervisorVehicleController(request, response) {
  try {
    await requireSupervisor(request);
    const idConductor = Number(request.body?.idConductor);
    const idVehiculo = request.body?.idVehiculo ? Number(request.body.idVehiculo) : null;

    if (!Number.isInteger(idConductor) || idConductor <= 0) {
      return response.status(400).json({ success: false, message: "El identificador del conductor no es válido." });
    }

    const result = await assignVehicleToDriver({ idConductor, idVehiculo });
    return response.json({
      success: true,
      data: result,
      message: idVehiculo ? "Vehículo asignado correctamente." : "Asignación vehicular removida."
    });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message || "No fue posible asignar el vehículo." });
  }
}

export async function listPendingSupervisorDriversController(request, response) {
  try {
    await requireSupervisor(request);
    const result = await databasePool.query(
      `
        SELECT
          c.id_conductores,
          c.nombre,
          c.telefono,
          c.empresa,
          c.licencia_numero,
          c.tipo_licencia,
          c.licencia_vencimiento,
          c.licencia_vigente,
          c.fecha_manejo_comentado,
          c.licencia_url,
          c.licencia_reverso_url,
          c.aprobado_por_admin,
          c.activo,
          c.creado_en,
          ut.telegram_user_id,
          ut.telegram_username,
          ut.estado_registro
        FROM conductores c
        LEFT JOIN usuarios_telegram ut ON ut.id_conductores = c.id_conductores
        WHERE c.aprobado_por_admin = FALSE
        ORDER BY c.creado_en DESC
      `
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message || "Error al listar conductores pendientes." });
  }
}

export async function decideSupervisorDriverController(request, response) {
  try {
    await requireSupervisor(request);
    const idConductor = Number(request.params.idConductor);
    const approved = Boolean(request.body?.aprobado ?? request.body?.aprobada ?? request.body?.approved);

    if (!Number.isInteger(idConductor) || idConductor <= 0) {
      return response.status(400).json({
        success: false,
        message: "El identificador del conductor no es válido."
      });
    }

    const updated = await approveAdminDriver({
      idConductor,
      aprobado: approved
    });

    if (!updated) {
      return response.status(404).json({
        success: false,
        message: "Conductor no encontrado."
      });
    }

    // Notificar al conductor por Telegram
    try {
      const tgUser = await findTelegramUserByConductorId(idConductor);
      if (tgUser?.telegram_user_id) {
        if (approved) {
          if (updated.pinGenerado) {
            await sendDriverPinNotification({
              telegramUserId: tgUser.telegram_user_id,
              pin: updated.pinGenerado,
              conductorNombre: updated.nombre,
              motivo: "APROBACION"
            });
          } else {
            await sendDriverApprovalNotification({
              telegramUserId: tgUser.telegram_user_id,
              approved: true
            });
          }
        } else {
          await sendDriverApprovalNotification({
            telegramUserId: tgUser.telegram_user_id,
            approved: false
          });
        }
      }
    } catch (telegramErr) {
      console.warn("No fue posible enviar notificación de aprobación por Telegram:", telegramErr.message);
    }

    return response.json({
      success: true,
      data: updated,
      message: approved ? "Conductor validado y aprobado exitosamente." : "Conductor rechazado."
    });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ success: false, message: error.message || "Error al procesar la decisión del conductor." });
  }
}


