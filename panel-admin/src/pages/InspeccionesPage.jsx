import { useEffect, useRef, useState } from "react";
import { decidirAdminInspeccion, descargarAdminInspeccionPdf, getAdminInspeccionDetalle, getAdminInspeccionPdfPreviewUrl, getAdminInspecciones } from "../services/api.js";
import DamageViewer from "../components/DamageViewer.jsx";

function formatDate(value) { return value ? new Date(value).toLocaleString("es-MX") : "—"; }

function ApprovalSignature({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  function point(event) { const canvas = canvasRef.current; const bounds = canvas.getBoundingClientRect(); return [(event.clientX - bounds.left) * (canvas.width / bounds.width), (event.clientY - bounds.top) * (canvas.height / bounds.height)]; }
  function start(event) { const [x, y] = point(event); const context = canvasRef.current.getContext("2d"); context.beginPath(); context.moveTo(x, y); context.lineWidth = 2.5; context.lineCap = "round"; drawing.current = true; canvasRef.current.setPointerCapture?.(event.pointerId); setHasSignature(true); }
  function draw(event) { if (!drawing.current) return; const [x, y] = point(event); const context = canvasRef.current.getContext("2d"); context.lineTo(x, y); context.stroke(); }
  function stop() { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current.toDataURL("image/png")); }
  function clear() { canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSignature(false); onChange(""); }
  return <section className="approval-signature"><label><span>Firma de aprobación</span><canvas ref={canvasRef} width="640" height="220" aria-label="Firma de aprobación" onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerLeave={stop}/></label><div><button type="button" className="secondary-button" disabled={!hasSignature} onClick={clear}>Limpiar firma</button><small>{hasSignature ? "Firma capturada." : "La firma es obligatoria para aprobar."}</small></div></section>;
}

export default function InspeccionesPage({ onPendingChange }) {
  const [rows, setRows] = useState([]); const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState(""); const [signature, setSignature] = useState(""); const [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    try { const response = await getAdminInspecciones(); setRows(response.data || []); onPendingChange?.((response.data || []).filter(item=>item.estado==="PENDIENTE_APROBACION").length); }
    catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);
  function closeDetail() { setDetail(null); }
  async function open(row) { try { const response=await getAdminInspeccionDetalle(row.id_inspeccion); setDetail(response.data); setComment(""); setSignature(""); } catch(error){setMessage(error.message);} }
  function openPreview() { if (!detail) return; window.open(getAdminInspeccionPdfPreviewUrl(detail.id_inspeccion), "_blank", "noopener"); }
  async function decide(aprobada) {
    if (aprobada && !signature) { setMessage("Captura la firma antes de aprobar la inspección."); return; }
    setSaving(true);
    try { const response=await decidirAdminInspeccion(detail.id_inspeccion,aprobada,comment,signature); setMessage(response.message); setDetail({...detail,...response.data}); await load(); }
    catch(error){setMessage(error.message);} finally{setSaving(false);}
  }
  return <section className="module-page"><header className="module-header"><div><span className="module-label">Logística</span><h1>Inspecciones vehiculares</h1><p>Revisa y aprueba el chequeo diario antes del primer viaje.</p></div></header>
    {message&&<p className="module-message">{message}</p>}
    <section className="table-panel">{loading?<p className="table-status">Cargando inspecciones...</p>:<div className="table-wrapper"><table className="admin-table"><thead><tr><th>Folio</th><th>Unidad</th><th>Conductor</th><th>Enviado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map(row=><tr key={row.id_inspeccion}><td>{row.folio}</td><td>{row.vehiculo}<small>{row.numero_economico}</small></td><td>{row.conductor}</td><td>{formatDate(row.creado_en)}</td><td><span className={`inspection-status inspection-status-${row.estado.toLowerCase()}`}>{row.estado.replaceAll("_"," ")}</span></td><td><button className="secondary-button" onClick={()=>open(row)}>Ver revisión</button>{row.estado==="APROBADA"&&<button className="secondary-button" onClick={()=>descargarAdminInspeccionPdf(row.id_inspeccion)}>PDF</button>}</td></tr>)}</tbody></table></div>}</section>
    {detail&&<div className="modal-overlay" onMouseDown={closeDetail}><section className="modal-card inspection-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="form-panel-header"><div><h2>Inspección {detail.folio}</h2><p>{detail.vehiculo} · {detail.numero_economico}</p></div><button className="close-button" onClick={closeDetail}>×</button></div><div className="inspection-detail-grid"><p><strong>Conductor:</strong> {detail.conductor}</p><p><strong>Combustible:</strong> {detail.combustible}</p><p><strong>Asignación:</strong> {detail.tipo_asignacion}</p><p><strong>Fuera de horario:</strong> {detail.requiere_autorizacion_fuera_horario?"Sí":"No"}</p><p><strong>Póliza:</strong> {detail.numero_poliza||"Sin registro"}</p><p><strong>Serie:</strong> {detail.numero_serie||"Sin registro"}</p></div><DamageViewer damages={detail.danos} vehicle={detail.vehiculo}/><h3>Checklist</h3><div className="admin-checklist">{Object.entries(detail.checklist||{}).map(([item,state])=><p key={item}><strong>{state}</strong> {item}</p>)}</div><h3>Observaciones</h3><p>{detail.observaciones_conductor||"Sin observaciones."}</p>{detail.firma_conductor&&<img className="admin-signature" src={detail.firma_conductor} alt="Firma del conductor"/>}{detail.estado==="PENDIENTE_APROBACION"?<div className="inspection-decision-panel"><button className="secondary-button inspection-preview-button" onClick={openPreview}>Abrir vista previa en una pestaña nueva</button><label className="inspection-comment-field"><span>Comentario de aprobación</span><textarea rows="4" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Escribe una observación para el conductor (opcional)"/></label><ApprovalSignature onChange={setSignature}/><div className="form-actions inspection-decision-actions"><button className="danger-button" disabled={saving} onClick={()=>decide(false)}>Rechazar</button><button className="primary-button" disabled={saving||!signature} onClick={()=>decide(true)}>Aprobar y generar PDF</button></div></div>:detail.estado==="APROBADA"&&<button className="primary-button" onClick={()=>descargarAdminInspeccionPdf(detail.id_inspeccion)}>Descargar reporte PDF</button>}</section></div>}
  </section>;
}
