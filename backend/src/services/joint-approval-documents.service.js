import {databasePool} from '../database/pool.js';
import {getGerenciamientoById,storeGerenciamientoPdf,updateGerenciamientoSharePointDetails}from'./gerenciamiento-viajes.service.js';
import {getInspectionByViaje,storeInspectionPdf,updateInspectionSharePointDetails}from'./inspecciones.service.js';
import {buildGerenciamientoWithAnnexes as buildGerenciamientoPdf,buildInspectionWithAnnexes as buildInspectionPdf}from'./trip-inspection-annexes.service.js';
import {uploadGerenciamientoPdfToSharePoint,uploadInspectionPdfToSharePoint}from'./sharepoint.service.js';
import {findTelegramUserByConductorId}from'./telegram-user.service.js';
import {sendDriverInspectionNotification}from'../bot/bot.js';
export async function publishJointApprovalDocuments(idGerenciamiento){
 try{
 const detail=await getGerenciamientoById(idGerenciamiento);if(!detail)return null;
 const trip=detail.id_viaje?(await databasePool.query('SELECT folio FROM viajes WHERE id_viajes=$1',[detail.id_viaje])).rows[0]:null;
 const inspection=detail.id_viaje?await getInspectionByViaje(detail.id_viaje):null;
 let sharepoint=null;
 try{const pdf=await buildGerenciamientoPdf(detail);await storeGerenciamientoPdf({idGerenciamiento,nombre:pdf.nombre,document:pdf.buffer});
 try{sharepoint=await uploadGerenciamientoPdfToSharePoint({filename:pdf.nombre,pdfBuffer:pdf.buffer,folio:detail.folio_documento||`GERENCIAMIENTO-${idGerenciamiento}`,date:detail.creado_en});if(sharepoint.success&&sharepoint.webUrl)await updateGerenciamientoSharePointDetails({idGerenciamiento,webUrl:sharepoint.webUrl,itemId:sharepoint.itemId});}catch{console.warn('PDF de gerenciamiento pendiente de subir a SharePoint.');}
 }catch{console.warn('PDF de gerenciamiento pendiente de regenerar.');}
 if(inspection){try{const pdf=await buildInspectionPdf(inspection);await storeInspectionPdf({idInspeccion:inspection.id_inspeccion,nombre:pdf.nombre,document:pdf.buffer});try{const uploaded=await uploadInspectionPdfToSharePoint({filename:pdf.nombre,pdfBuffer:pdf.buffer,folio:inspection.folio,date:inspection.creado_en});if(uploaded.success&&uploaded.webUrl)await updateInspectionSharePointDetails({idInspeccion:inspection.id_inspeccion,webUrl:uploaded.webUrl,itemId:uploaded.itemId});}catch{console.warn('PDF de inspección pendiente de subir a SharePoint.');}}catch{console.warn('PDF de inspección pendiente de regenerar.');}
 try{const telegram=await findTelegramUserByConductorId(inspection.id_conductores);await sendDriverInspectionNotification({telegramUserId:telegram?.telegram_user_id,approved:true,managementApproved:true,trip:{idViaje:detail.id_viaje,folio:trip?.folio||inspection.folio,vehiculo:inspection.vehiculo},comment:detail.observaciones});}catch{console.warn('Notificación de aprobación conjunta pendiente.');}}
 return sharepoint;
 }catch{console.warn('La aprobación quedó guardada; no fue posible actualizar sus documentos externos.');return null;}
}
