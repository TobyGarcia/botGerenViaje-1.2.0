import { approveInspection, countPendingInspections, getAdminInspection, getStoredInspectionPdf, listPendingInspections, storeInspectionPdf, updateInspectionSharePointDetails } from "../services/inspecciones.service.js";
import { buildInspectionPdf } from "../services/inspeccion-pdf.service.js";
import { cancelTrip } from "../services/viajes.service.js";
import { findTelegramUserByConductorId } from "../services/telegram-user.service.js";
import { sendDriverInspectionNotification } from "../bot/bot.js";
import { uploadInspectionPdfToSharePoint } from "../services/sharepoint.service.js";

export async function listAdminInspectionsController(request, response) {
  try { return response.json({ success: true, data: await listPendingInspections() }); }
  catch { return response.status(500).json({ success: false, message: "No fue posible consultar las inspecciones." }); }
}
export async function countAdminInspectionsController(request, response) {
  try { return response.json({ success: true, data: { total: await countPendingInspections() } }); }
  catch { return response.status(500).json({ success: false, message: "No fue posible consultar las notificaciones." }); }
}
export async function getAdminInspectionController(request, response) {
  const data = await getAdminInspection(Number(request.params.idInspeccion));
  return data ? response.json({ success: true, data }) : response.status(404).json({ success: false, message: "Inspección no encontrada." });
}
export async function decideAdminInspectionController(request, response) {
  try {
    if (!["ADMINISTRADOR", "SUPERVISOR"].includes(request.adminUser?.rol)) return response.status(403).json({ success: false, message: "No tienes permiso para aprobar inspecciones." });
    const approved = request.body?.aprobada;
    if (typeof approved !== "boolean") return response.status(400).json({ success: false, message: "La decisión no es válida." });
    const idInspeccion = Number(request.params.idInspeccion);
    const comment = String(request.body?.comentario || "").trim();
    const signature = String(request.body?.firma || "");
    if (approved && !signature.startsWith("data:image/png;base64,")) return response.status(400).json({ success: false, message: "La firma del aprobador es obligatoria." });
    const data = await approveInspection({ idInspeccion, idUsuarioAdmin: request.adminUser.id_usuarios_admin, approved, comentario: comment, firmaSupervisor: approved ? signature : null });
    let trip = null;
    let sharepointResult = null;
    if (data && approved) {
      const detail = await getAdminInspection(idInspeccion);
      const pdf = buildInspectionPdf(detail);
      await storeInspectionPdf({ idInspeccion, nombre: pdf.nombre, document: pdf.buffer });
      
      try {
        sharepointResult = await uploadInspectionPdfToSharePoint({
          folio: detail.folio,
          filename: pdf.nombre,
          pdfBuffer: pdf.buffer,
          date: detail.creado_en || detail.aprobado_en
        });
        if (sharepointResult.success && sharepointResult.webUrl) {
          await updateInspectionSharePointDetails({ idInspeccion, webUrl: sharepointResult.webUrl, itemId: sharepointResult.itemId });
        }
      } catch (spError) {
        console.error("[AdminInspecciones] Error al subir a SharePoint:", spError.message);
      }

      trip = {
        idViaje: detail.id_viajes,
        folio: detail.folio,
        vehiculo: detail.vehiculo,
        conductor: detail.conductor
      };
    }
    if (data && !approved) {
      trip = await cancelTrip({
        idViaje: data.id_viajes,
        observaciones: `Inspección vehicular rechazada.${comment ? ` Motivo: ${comment}` : ""}`
      });
    }
    if (data) {
      const telegramUser = await findTelegramUserByConductorId(data.id_conductores);
      await sendDriverInspectionNotification({
        telegramUserId: telegramUser?.telegram_user_id,
        approved,
        trip,
        comment
      });
    }
    return data ? response.json({ success: true, data: { ...data, viaje: trip }, message: approved ? "Inspección aprobada. El conductor ya puede iniciar el viaje." : "Inspección rechazada. El viaje fue cancelado y el conductor fue notificado." }) : response.status(409).json({ success: false, message: "La inspección ya fue atendida." });
  } catch (error) { return response.status(500).json({ success: false, message: error.message }); }
}

export async function downloadAdminInspectionPdfController(request, response) {
  const idInspeccion = Number(request.params.idInspeccion);
  let stored = await getStoredInspectionPdf(idInspeccion);
  if (!stored?.pdf_documento) {
    const detail = await getAdminInspection(idInspeccion);
    if (!detail) return response.status(404).json({ success: false, message: "Inspección no encontrada." });
    const pdf = buildInspectionPdf(detail);
    await storeInspectionPdf({ idInspeccion, nombre: pdf.nombre, document: pdf.buffer });
    stored = { pdf_nombre: pdf.nombre, pdf_documento: pdf.buffer };
  }
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=\"${stored.pdf_nombre}\"`);
  return response.send(stored.pdf_documento);
}

export async function previewAdminInspectionPdfController(request, response) {
  try {
    const idInspeccion = Number(request.params.idInspeccion);
    const detail = await getAdminInspection(idInspeccion);
    if (!detail) {
      return response.status(404).json({ success: false, message: "Inspección no encontrada." });
    }

    const pdf = buildInspectionPdf({
      ...detail,
      estado: detail.estado === "PENDIENTE_APROBACION" ? "PENDIENTE_APROBACION" : detail.estado,
      aprobador: detail.aprobador || "Pendiente de aprobación",
      aprobado_en: detail.aprobado_en || null
    });
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="vista-previa-${pdf.nombre}"`);
    response.setHeader("Cache-Control", "no-store");
    return response.send(pdf.buffer);
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message || "No fue posible generar la vista previa." });
  }
}
