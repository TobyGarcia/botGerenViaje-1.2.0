import { approveInspection, countPendingInspections, getAdminInspection, getStoredInspectionPdf, listPendingInspections, storeInspectionPdf } from "../services/inspecciones.service.js";
import { buildInspectionPdf } from "../services/inspeccion-pdf.service.js";

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
    const data = await approveInspection({ idInspeccion, idUsuarioAdmin: request.adminUser.id_usuarios_admin, approved, comentario: String(request.body?.comentario || "").trim() });
    if (data && approved) {
      const detail = await getAdminInspection(idInspeccion);
      const pdf = buildInspectionPdf(detail);
      await storeInspectionPdf({ idInspeccion, nombre: pdf.nombre, document: pdf.buffer });
    }
    return data ? response.json({ success: true, data, message: approved ? "Inspección aprobada." : "Inspección rechazada." }) : response.status(409).json({ success: false, message: "La inspección ya fue atendida." });
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
