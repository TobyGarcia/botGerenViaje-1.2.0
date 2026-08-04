import { useEffect, useState } from "react";
import { decidirAdminInspeccion, descargarAdminInspeccionPdf, getAdminInspeccionDetalle, getAdminInspeccionPdfPreviewUrl, getAdminInspecciones } from "../services/api.js";

function formatDate(value) { return value ? new Date(value).toLocaleString("es-MX") : "—"; }

export default function InspeccionesPage({ onPendingChange }) {
  const [rows, setRows] = useState([]); const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState(""); const [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    try { const response = await getAdminInspecciones(); setRows(response.data || []); onPendingChange?.((response.data || []).filter(item=>item.estado==="PENDIENTE_APROBACION").length); }
    catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);
  function closeDetail() { setDetail(null); }
  async function open(row) { try { const response=await getAdminInspeccionDetalle(row.id_inspeccion); setDetail(response.data); setComment(""); } catch(error){setMessage(error.message);} }
  function openPreview() { if (!detail) return; window.open(getAdminInspeccionPdfPreviewUrl(detail.id_inspeccion), "_blank", "noopener"); }
  async function decide(aprobada) {
    setSaving(true);
    try { const response=await decidirAdminInspeccion(detail.id_inspeccion,aprobada,comment); setMessage(response.message); setDetail({...detail,...response.data}); await load(); }
    catch(error){setMessage(error.message);} finally{setSaving(false);}
  }
  return <section className="module-page"><header className="module-header"><div><span className="module-label">Logística</span><h1>Inspecciones vehiculares</h1><p>Revisa y aprueba el chequeo diario antes del primer viaje.</p></div></header>
    {message&&<p className="module-message">{message}</p>}
    <section className="table-panel">{loading?<p className="table-status">Cargando inspecciones...</p>:<div className="table-wrapper"><table className="admin-table"><thead><tr><th>Folio</th><th>Unidad</th><th>Conductor</th><th>Enviado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map(row=><tr key={row.id_inspeccion}><td>{row.folio}</td><td>{row.vehiculo}<small>{row.numero_economico}</small></td><td>{row.conductor}</td><td>{formatDate(row.creado_en)}</td><td><span className={`inspection-status inspection-status-${row.estado.toLowerCase()}`}>{row.estado.replaceAll("_"," ")}</span></td><td><button className="secondary-button" onClick={()=>open(row)}>Ver revisión</button>{row.estado==="APROBADA"&&<button className="secondary-button" onClick={()=>descargarAdminInspeccionPdf(row.id_inspeccion)}>PDF</button>}</td></tr>)}</tbody></table></div>}</section>
    {detail&&<div className="modal-overlay" onMouseDown={closeDetail}><section className="modal-card inspection-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="form-panel-header"><div><h2>Inspección {detail.folio}</h2><p>{detail.vehiculo} · {detail.numero_economico}</p></div><button className="close-button" onClick={closeDetail}>×</button></div><div className="inspection-detail-grid"><p><strong>Conductor:</strong> {detail.conductor}</p><p><strong>Combustible:</strong> {detail.combustible}</p><p><strong>Asignación:</strong> {detail.tipo_asignacion}</p><p><strong>Fuera de horario:</strong> {detail.requiere_autorizacion_fuera_horario?"Sí":"No"}</p><p><strong>Póliza:</strong> {detail.numero_poliza||"Sin registro"}</p><p><strong>Serie:</strong> {detail.numero_serie||"Sin registro"}</p></div><h3>Daños marcados</h3><div className="damage-summary">{Object.entries(detail.danos||{}).map(([view,points])=><span key={view}>{view}: {points.length}</span>)}</div><h3>Checklist</h3><div className="admin-checklist">{Object.entries(detail.checklist||{}).map(([item,state])=><p key={item}><strong>{state}</strong> {item}</p>)}</div><h3>Observaciones</h3><p>{detail.observaciones_conductor||"Sin observaciones."}</p>{detail.firma_conductor&&<img className="admin-signature" src={detail.firma_conductor} alt="Firma del conductor"/>}{detail.estado==="PENDIENTE_APROBACION"?<><button className="secondary-button" onClick={openPreview}>Abrir vista previa en una pestaña nueva</button><label>Comentario<textarea value={comment} onChange={e=>setComment(e.target.value)}/></label><div className="form-actions"><button className="danger-button" disabled={saving} onClick={()=>decide(false)}>Rechazar</button><button className="primary-button" disabled={saving} onClick={()=>decide(true)}>Aprobar y generar PDF</button></div></>:detail.estado==="APROBADA"&&<button className="primary-button" onClick={()=>descargarAdminInspeccionPdf(detail.id_inspeccion)}>Descargar reporte PDF</button>}</section></div>}
  </section>;
}
