import AppFeedbackModal from '../components/AppFeedbackModal.jsx';
import {useModalBack} from '../hooks/useModalBack.js';
import ApprovalTripCard,{approvalVehicleName} from '../components/ApprovalTripCard.jsx';
import {useApprovalLiveRefresh} from "../hooks/useApprovalLiveRefresh.js";
import {refreshApproverNotifications} from "../components/SupervisorNotifications.jsx";
import {canApproveRisk} from '../../../backend/src/utils/approval-policy.js';
import { apiFetch, readApiJson } from "../services/http-transport.js";
import { useCallback, useEffect, useRef, useState } from "react";
import ApprovalPdfViewer from "../components/ApprovalPdfViewer.jsx";
import ManagementReviewContent from "../components/ManagementReviewContent.jsx";
import { IconDocumento } from "../components/Icons.jsx";

function ApprovalSignature({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function point(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) * (canvas.width / bounds.width),
      (event.clientY - bounds.top) * (canvas.height / bounds.height)
    ];
  }

  function start(event) {
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    drawing.current = true;
    canvasRef.current.setPointerCapture?.(event.pointerId);
    setHasSignature(true);
  }

  function draw(event) {
    if (!drawing.current) return;
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(x, y);
    context.stroke();
  }

  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    if (canvasRef.current) {
      canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasSignature(false);
    onChange("");
  }

  return (
    <div style={{ marginTop: "6px" }}>
      <label style={{ fontSize: "0.82rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
        Firma Digital del Autorizador *
      </label>
      <div style={{ border: "1.5px dashed #000000", borderRadius: "4px", background: "#ffffff", padding: "2px" }}>
        <canvas
          ref={canvasRef}
          width="640"
          height="140"
          style={{ width: "100%", height: "110px", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
          {hasSignature ? "✓ Firma capturada." : "Dibuja tu firma con ratón o pantalla táctil."}
        </small>
        <button
          type="button"
          disabled={!hasSignature}
          onClick={clear}
          style={{ background: "#e2e8f0", border: 0, padding: "3px 8px", borderRadius: "3px", cursor: "pointer", fontSize: "0.75rem" }}
        >
          Limpiar Firma
        </button>
      </div>
    </div>
  );
}

export default function GerenciamientoAdminPage({ user, initialStatus = "", onDecision }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorAcknowledged,setErrorAcknowledged]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const [filterRiesgo, setFilterRiesgo] = useState("");
  const [filterEstado, setFilterEstado] = useState(initialStatus);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfPreview,setPdfPreview]=useState(null);
  const [reviewTab,setReviewTab]=useState("trip");
  const [reviewLoading,setReviewLoading]=useState(false);
  const [reviewError,setReviewError]=useState("");
  const reviewBody=useRef(null);
  useEffect(()=>{setReviewTab("trip");},[selectedDoc?.id_gerenciamiento]);
  function changeReviewTab(tab){setReviewTab(tab);reviewBody.current?.scrollTo({top:0});}
  const selectedRef=useRef(selectedDoc);selectedRef.current=selectedDoc;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Approval modal state
  const [approving, setApproving] = useState(false);
  const [firmaAutorizador, setFirmaAutorizador] = useState("");
  const [observaciones, setObservaciones] = useState("");
  useModalBack(Boolean(selectedDoc),()=>setSelectedDoc(null),approving);

  const API_BASE_URL = `${String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "").replace(/\/api$/, "")}/api`;

  const loadData = useCallback(async ({background=false,signal}={}) => {
    if(!background){setLoading(true);setError("");setErrorAcknowledged(false);}
    try {
      let url = `${API_BASE_URL}/gerenciamiento-viajes?`;
      if (filterRiesgo) url += `riesgo=${filterRiesgo}&`;
      if (filterEstado) url += `estado=${filterEstado}&`;
      if(import.meta.env.VITE_SUPERVISOR_APP==='true'&&filterEstado==='PENDIENTE')url+='includeInspection=true&';

      const id=selectedRef.current?.id_gerenciamiento;
      const options={signal,cache:"no-store",headers:{Authorization:`Bearer ${localStorage.getItem("adminToken")}`}};
      const [gerenRes,review]=await Promise.all([apiFetch(url,options),id?apiFetch(`${API_BASE_URL}/gerenciamiento-viajes/${id}`,options).then(async response=>response.ok?readApiJson(response):null).catch(()=>null):null]);

      if (!gerenRes.ok) throw new Error("Error cargando gerenciamientos de viaje.");
      const gerenData = await readApiJson(gerenRes);
      if(signal?.aborted)return;
      setList(gerenData.data || []);
      if(review?.data&&String(selectedRef.current?.id_gerenciamiento)===String(id)){setReviewError("");setSelectedDoc(previous=>String(previous?.id_gerenciamiento)===String(id)?{...previous,...review.data}:previous);}
    } catch (err) {
      if(!background&&!signal?.aborted)setError(err.message || "Error conectando con el servidor.");
    } finally {
      if(!background&&!signal?.aborted)setLoading(false);
    }
  }, [API_BASE_URL, filterRiesgo, filterEstado]);

  useEffect(()=>{const controller=new AbortController();void loadData({signal:controller.signal});return()=>controller.abort();},[loadData]);
  useApprovalLiveRefresh(loadData,!approving&&!loading);
  useEffect(()=>{
    if(!selectedDoc?.id_gerenciamiento)return;
    const controller=new AbortController(),id=selectedDoc.id_gerenciamiento;
    setReviewLoading(true);setReviewError('');
    apiFetch(`${API_BASE_URL}/gerenciamiento-viajes/${id}`,{signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${localStorage.getItem('adminToken')}`}})
      .then(async response=>{const body=await readApiJson(response);if(!response.ok)throw Error(body.message||'No se pudo cargar el detalle.');if(!controller.signal.aborted)setSelectedDoc(previous=>String(previous?.id_gerenciamiento)===String(id)?{...previous,...body.data}:previous);})
      .catch(error=>{if(!controller.signal.aborted)setReviewError(error.message);})
      .finally(()=>{if(!controller.signal.aborted)setReviewLoading(false);});
    return()=>controller.abort();
  },[selectedDoc?.id_gerenciamiento,API_BASE_URL]);


  const pendingReview=selectedDoc&&(selectedDoc.estado==='PENDIENTE'||(selectedDoc.estado==='APROBADO'&&selectedDoc.inspeccion_estado==='PENDIENTE_APROBACION'));
  const inspectionOnly=selectedDoc?.estado==='APROBADO'&&selectedDoc?.inspeccion_estado==='PENDIENTE_APROBACION';
  async function handleDecide(nuevoEstado) {
    if (nuevoEstado === "APROBADO" && !firmaAutorizador) {
      setFeedback({type:"info",title:"Firma requerida",message:"Captura tu firma antes de aprobar."});
      return;
    }

    setApproving(true);
    try {
      const res = await apiFetch(inspectionOnly?`${API_BASE_URL}/admin/inspecciones/${selectedDoc.id_inspeccion}/decision`:`${API_BASE_URL}/gerenciamiento-viajes/${selectedDoc.id_gerenciamiento}/decision`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`
        },
        body: JSON.stringify(inspectionOnly?{aprobada:nuevoEstado==='APROBADO',firma:firmaAutorizador,comentario:observaciones}:{
          estado: nuevoEstado,
          firmaAutorizador: firmaAutorizador,
          observaciones: observaciones
        })
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.message || "Error procesando solicitud.");

      setSelectedDoc(null);
      await Promise.all([loadData(), onDecision?.(),refreshApproverNotifications()]);
      setFeedback({type:"success",title:"Solicitud atendida",message:data.message || "La decisión se guardó correctamente."});
    } catch (err) {
      setFeedback({type:"error",title:"No se pudo completar",message:err.message});
    } finally {
      setApproving(false);
    }
  }

  function openGerenciamientoPdfPreview(doc) {
    setPdfPreview({kind:'management',id:doc.id_gerenciamiento,title:doc.folio_documento||'Gerenciamiento'});
  }


  function formatDate(value) {
    return value ? new Date(value).toLocaleString("es-MX") : "—";
  }

  const totalFiltered = list.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  useEffect(()=>{setCurrentPage(page=>Math.min(page,totalPages));},[totalPages]);
  const paginatedList = list.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <>
      {/* Filtros idénticos al diseño del proyecto */}
      <div className="geren-filters" style={{ display: "flex", gap: "14px", background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Nivel de Riesgo:
          <select
            value={filterRiesgo}
            onChange={(e) => {
              setFilterRiesgo(e.target.value);
              setCurrentPage(1);
            }}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            <option value="">Todos los Riesgos</option>
            <option value="BAJO">Riesgo Bajo (0-15)</option>
            <option value="MEDIO">Riesgo Medio (16-22)</option>
            <option value="ALTO">Riesgo Alto (&gt;23)</option>
          </select>
        </label>

        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Estado:
          <select
            value={filterEstado}
            onChange={(e) => {
              setFilterEstado(e.target.value);
              setCurrentPage(1);
            }}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            <option value="">Todos los Estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADO">Aprobados</option>
            <option value="RECHAZADO">Rechazados</option>
          </select>
        </label>

        <button onClick={loadData} className="secondary-button" style={{ marginLeft: "auto" }}>
          Actualizar
        </button>
      </div>

      <section className="table-panel">
        {loading ? (
          <p className="table-status">Cargando gerenciamientos...</p>
        ) : error ? (
          <p className="table-status">No se pudo cargar esta vista. Usa Actualizar para reintentar.</p>
        ) : list.length === 0 ? (
          <p className="table-status">No se encontraron documentos de gerenciamiento de viaje registrados.</p>
        ) : (
          <>
            {import.meta.env.VITE_SUPERVISOR_APP === 'true' && <div className="supervisor-review-cards">{paginatedList.map(item=><ApprovalTripCard key={item.id_gerenciamiento} record={item} onReview={()=>{setSelectedDoc(item);setFirmaAutorizador('');setObservaciones(item.observaciones||'');}}/>)}</div>}
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Unidad</th>
                    <th>Conductor</th>
                    <th>Enviado</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((item) => {
                    const estadoNormalized = item.estado === "APROBADO" ? "aprobada" : item.estado === "RECHAZADO" ? "rechazada" : "pendiente_aprobacion";

                    return (
                      <tr key={item.id_gerenciamiento}>
                        <td>
                          <strong>{item.folio_documento} #{item.id_gerenciamiento}</strong>
                          <small style={{ display: "block", color: "#64748b" }}>
                            Ruta: {item.origen_nombre || item.origen_texto || "Origen"} ➔ {item.destino_nombre || item.destino_texto || "Destino"}
                          </small>
                        </td>
                        <td>
                          {approvalVehicleName(item)}
                          <small style={{ display: "block" }}>{item.numero_unidad || item.placa || "N/A"}</small>
                        </td>
                        <td>{item.nombre_conductor || item.conductor_nombre}</td>
                        <td>{formatDate(item.creado_en || item.fecha_emision)}</td>
                        <td>
                          <span className={`inspection-status inspection-status-${estadoNormalized}`}>
                            {item.viaje_cancelado&&item.estado==="PENDIENTE"?"RETIRADO":item.estado === "APROBADO" ? "APROBADO" : item.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE"}
                          </span>
                          <small style={{ display: "block", fontSize: "0.72rem", color: "#475569", marginTop: "2px" }}>
                            {item.nivel_riesgo} ({item.puntaje_total} pts)
                          </small>
                        </td>
                        <td style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button className="secondary-button" onClick={() => { setSelectedDoc(item); setFirmaAutorizador(""); setObservaciones(item.observaciones || "");  }}>
                            Ver revisión
                          </button>
                          <button className="secondary-button" onClick={() => openGerenciamientoPdfPreview(item, true)}>
                            PDF
                          </button>
                          {item.sharepoint_web_url && (
                            <a
                              href={item.sharepoint_web_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="secondary-button"
                              style={{ textDecoration: "none", color: "#0284c7", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "5px" }}
                            >
                              <IconDocumento size={14} /> SharePoint
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} documentos
                </span>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Anterior
                  </button>
                  <span className="pagination-page-indicator">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {error&&!errorAcknowledged&&<AppFeedbackModal type="error" title="No se pudo cargar" message={error} onClose={()=>setErrorAcknowledged(true)}/>}
      {feedback&&<AppFeedbackModal {...feedback} onClose={()=>setFeedback(null)}/>}
      {pdfPreview&&<ApprovalPdfViewer document={pdfPreview} onClose={()=>setPdfPreview(null)}/>}
      {/* Modal con Hoja Completa Oficial SII-MX-23-LOG-003 */}
      {selectedDoc && (
        <div className="modal-overlay" onMouseDown={() => {if(!approving)setSelectedDoc(null);}}>
          <section className="modal-card inspection-detail-modal management-review-dialog" role="dialog" aria-modal="true" aria-labelledby="management-review-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="form-panel-header">
              <div>
                <span className="management-eyebrow">Revisión de viaje</span><h2 id="management-review-title">{selectedDoc.folio_documento}</h2>
                <p>{selectedDoc.nombre_conductor} · {approvalVehicleName(selectedDoc)} ({selectedDoc.numero_unidad || selectedDoc.placa})</p>
              </div>
              <button className="management-pdf-button" type="button" onClick={()=>openGerenciamientoPdfPreview(selectedDoc,true)}>PDF</button><button className="close-button" aria-label="Cerrar revisión" disabled={approving} onClick={() => setSelectedDoc(null)}>×</button>
            </div>

            <nav className="management-review-tabs" role="tablist" aria-label="Revisar gerenciamiento">
              {[['trip','Viaje'],['inspection','Inspección'],['authorization',pendingReview?'Autorizar':'Resolución']].map(([id,label])=><button type="button" key={id} id={`management-${id}-tab`} role="tab" aria-selected={reviewTab===id} tabIndex={reviewTab===id?0:-1} onKeyDown={event=>{const keys=["trip","inspection","authorization"];let next;if(event.key==="ArrowRight")next=keys[(keys.indexOf(id)+1)%3];if(event.key==="ArrowLeft")next=keys[(keys.indexOf(id)+2)%3];if(next){event.preventDefault();changeReviewTab(next);document.getElementById(`management-${next}-tab`)?.focus();}}} aria-controls={`management-${id}-panel`} onClick={()=>changeReviewTab(id)}>{label}</button>)}
            </nav>
            <div className="management-review-body" ref={reviewBody}>
            {reviewLoading&&<p role="status" className="management-loading">Cargando detalle completo…</p>}
            {reviewError&&<p role="alert" className="management-note">{reviewError} <button type="button" onClick={()=>void loadData({background:true})}>Reintentar</button></p>}
            <ManagementReviewContent key={selectedDoc.id_gerenciamiento} doc={selectedDoc} tab={reviewTab}/>
            <section id="management-authorization-panel" role="tabpanel" aria-labelledby="management-authorization-tab" hidden={reviewTab!=='authorization'}>
            {/* Sección de Aprobación Unificada si está pendiente */}
            {pendingReview && selectedDoc.approval_available!==false ? (
              <div className="inspection-decision-panel">
                <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "12px", background: selectedDoc.nivel_riesgo === "ALTO" ? "#fee2e2" : selectedDoc.nivel_riesgo === "MEDIO" ? "#fef9c3" : "#dcfce7", border: "1px solid #cbd5e1", fontSize: "0.85rem", color: "#000" }}>
                  {selectedDoc.nivel_riesgo === "ALTO" ? (
                    <span>🔴 <strong>RIESGO ALTO ({selectedDoc.puntaje_total} pts):</strong> Requiere aprobación obligatoria de <strong>GERENCIA GENERAL (GERENTE)</strong>.</span>
                  ) : selectedDoc.nivel_riesgo === "MEDIO" ? (
                    <span>🟡 <strong>RIESGO MEDIO ({selectedDoc.puntaje_total} pts):</strong> Requiere aprobación de <strong>COORDINACIÓN DE ÁREA (COORDINADOR)</strong>.</span>
                  ) : (
                    <span>🟢 <strong>RIESGO BAJO ({selectedDoc.puntaje_total} pts):</strong> Autoriza <strong>SUPERVISOR DIRECTO O QHSE</strong>.</span>
                  )}
                </div>

                <div className="inspection-decision-section">
                  <label className="inspection-comment-field">
                    <span>Persona autorizadora</span>
                    <input type="text" value={user?.nombre || user?.username || ""} readOnly />
                  </label>
                </div>

                <div className="inspection-decision-section">
                  <label className="inspection-comment-field">
                    <span>Observaciones / Acciones de Control:</span>
                    <textarea
                      rows="2"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Comentarios u observaciones de control"
                    />
                  </label>
                </div>

                <div className="inspection-decision-section">
                  <ApprovalSignature onChange={setFirmaAutorizador} />
                </div>


              </div>
            ) : (
              <div className="management-resolution">
                <strong>{selectedDoc.approval_available===false&&selectedDoc.estado==="PENDIENTE"?"Solicitud retirada. El viaje está cancelado o ya no admite aprobación.":<>Documento {selectedDoc.estado} por {selectedDoc.nombre_autorizador_firma || "Autorizador"}</>}</strong>
                <p>{selectedDoc.observaciones||'Sin observaciones de resolución registradas.'}</p>
                {selectedDoc.firma_autorizador&&<img className="management-signature" src={selectedDoc.firma_autorizador} alt="Firma del autorizador"/>}
              </div>
            )}
            </section>
            </div>
            <footer className="management-review-footer">
              {reviewTab==='authorization'&&pendingReview&&selectedDoc.approval_available!==false ? (
                <div className="inspection-decision-section form-actions inspection-decision-actions">
                  <button
                    type="button"
                    className="danger-button"
                    disabled={approving || reviewLoading || Boolean(reviewError)}
                    onClick={() => handleDecide("RECHAZADO")}
                  >
                    {inspectionOnly?'Rechazar inspección':import.meta.env.VITE_SUPERVISOR_APP === 'true' ? 'Rechazar' : 'Rechazar Viaje'}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={approving || reviewLoading || Boolean(reviewError) || !firmaAutorizador || !canApproveRisk(user?.rol,selectedDoc.nivel_riesgo)}
                    onClick={() => handleDecide("APROBADO")}
                  >
                    {inspectionOnly?'Aprobar inspección':import.meta.env.VITE_SUPERVISOR_APP === 'true' ? 'Aprobar ambos' : 'Aprobar Gerenciamiento e Inspección'}
                  </button>
                </div>
              ) : <>
                {reviewTab!=='trip'&&<button type="button" className="secondary-button" onClick={()=>changeReviewTab(reviewTab==='authorization'?'inspection':'trip')}>Atrás</button>}
                {reviewTab!=='authorization'?<button type="button" className="primary-button" onClick={()=>changeReviewTab(reviewTab==='trip'?'inspection':'authorization')}>{reviewTab==='trip'?'Revisar inspección':pendingReview?'Continuar a autorización':'Ver resolución'}</button>:<button type="button" className="primary-button" onClick={()=>setSelectedDoc(null)}>Cerrar revisión</button>}
              </>}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
