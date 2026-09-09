import { useEffect, useRef, useState } from "react";
import {
  decidirAdminInspeccion,
  descargarAdminInspeccionPdf,
  getAdminInspeccionDetalle,
  getAdminInspeccionPdfPreviewUrl,
  getAdminInspecciones
} from "../services/api.js";
import DamageViewer from "../components/DamageViewer.jsx";
import GerenciamientoAdminPage from "./GerenciamientoAdminPage.jsx";
import { IconInspecciones, IconDestinos, IconLuna } from "../components/Icons.jsx";

const checklistGroups = {
  "Documentación": ["Tarjeta de circulación vigente", "Póliza de seguro vigente", "Verificación vigente", "Engomado de placas", "Placa delantera", "Placa trasera", "Plan de respuesta de emergencia", "Bitácora vehicular"],
  "Extintor": ["Plan de seguridad", "Carga vigente", "Etiqueta de inspección", "Soporte para extintor"],
  "Kit de carretera": ["Elevador manual (gato)", "Linterna", "Triángulos reflectores (2)", "Botiquín", "Cable pasa-corriente"],
  "Condiciones generales": ["Neumático delantero derecho", "Neumático delantero izquierdo", "Neumático trasero derecho", "Neumático trasero izquierdo", "Presión de neumáticos"],
  "Parabrisas y espejos": ["Parabrisas frontal", "Vidrios", "Espejo lateral derecho", "Espejo lateral izquierdo", "Retrovisor"],
  "Luces": ["Delanteras", "Intermitentes", "Freno", "Reversa", "Faros de niebla"],
  "Revisión mecánica": ["Aceite de motor", "Líquido refrigerante", "Fluido de transmisión", "Líquido de frenos", "Freno de mano", "Bandas de motor", "Líquido de dirección", "Batería", "Limpiador de vidrios", "Cinturones de seguridad", "Llave de cruz", "Monitor de velocidad", "Neumático de repuesto"],
  "Limpieza": ["Interior", "Exterior"]
};

function renderChecklistByCategories(checklist = {}) {
  const renderedItems = new Set();
  const categories = Object.entries(checklistGroups).map(([groupName, items]) => {
    const groupItems = items.filter(item => item in checklist).map(item => {
      renderedItems.add(item);
      return [item, checklist[item]];
    });
    return { groupName, items: groupItems };
  }).filter(g => g.items.length > 0);

  const otherItems = Object.entries(checklist).filter(([item]) => !renderedItems.has(item));
  if (otherItems.length > 0) {
    categories.push({ groupName: "Otros elementos", items: otherItems });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", marginTop: "12px", marginBottom: "16px" }}>
      {categories.map(({ groupName, items }) => (
        <div key={groupName} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", fontWeight: "bold", fontSize: "0.85rem", color: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{groupName}</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "normal" }}>{items.length} elementos</span>
          </div>
          <table className="admin-table checklist-table" style={{ margin: 0, width: "100%", fontSize: "0.82rem" }}>
            <tbody>
              {items.map(([item, state]) => (
                <tr key={item} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 12px" }}>{item}</td>
                  <td style={{ width: "65px", textAlign: "center", padding: "6px 8px" }}>
                    <span className={`checklist-badge checklist-badge-${state === "B" ? "good" : state === "R" ? "regular" : state === "M" ? "bad" : "na"}`}>
                      {state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

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

export default function InspeccionesPage({ user, onPendingChange }) {
  const [activeTab, setActiveTab] = useState("inspecciones");
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  async function load() {
    setLoading(true);
    try {
      const response = await getAdminInspecciones();
      setRows(response.data || []);
      onPendingChange?.((response.data || []).filter(item => item.estado === "PENDIENTE_APROBACION").length);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function closeDetail() { setDetail(null); }
  async function open(row) {
    try {
      const response = await getAdminInspeccionDetalle(row.id_inspeccion);
      setDetail(response.data);
      setComment("");
      setSignature("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function openPreview() {
    if (!detail) return;
    window.open(getAdminInspeccionPdfPreviewUrl(detail.id_inspeccion), "_blank", "noopener");
  }

  async function decide(aprobada) {
    if (aprobada && !signature) {
      setMessage("Captura la firma antes de aprobar la inspección.");
      return;
    }
    setSaving(true);
    try {
      const response = await decidirAdminInspeccion(detail.id_inspeccion, aprobada, comment, signature);
      setMessage(response.message);
      setDetail({ ...detail, ...response.data });
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (r.folio || "").toLowerCase().includes(term) ||
      (r.conductor || "").toLowerCase().includes(term) ||
      (r.vehiculo || "").toLowerCase().includes(term) ||
      (r.numero_economico || "").toLowerCase().includes(term)
    );
  });

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Logística</span>
          <h1>Inspecciones y Gerenciamientos</h1>
          <p>Revisa las inspecciones vehiculares diarias y los gerenciamientos de viajes fuera de la ciudad.</p>
        </div>
      </header>

      {/* Sub-pestañas */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
        <button
          type="button"
          onClick={() => { setActiveTab("inspecciones"); setCurrentPage(1); }}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: activeTab === "inspecciones" ? "#0f172a" : "#f1f5f9",
            color: activeTab === "inspecciones" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <IconInspecciones size={18} /> Inspecciones Vehiculares
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("gerenciamiento"); setCurrentPage(1); }}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: activeTab === "gerenciamiento" ? "linear-gradient(135deg, #1e3a8a, #0284c7)" : "#f1f5f9",
            color: activeTab === "gerenciamiento" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <IconDestinos size={18} /> Gerenciamiento de Viajes
        </button>
      </div>

      {activeTab === "gerenciamiento" ? (
        <GerenciamientoAdminPage user={user} />
      ) : (
        <>
          <section className="module-toolbar">
            <label className="search-field">
              <span>Buscar</span>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Folio, conductor, vehículo o número económico..."
              />
            </label>
          </section>

          {message && <p className="module-message">{message}</p>}

          <section className="table-panel">
            {loading ? (
              <p className="table-status">Cargando inspecciones...</p>
            ) : paginatedRows.length === 0 ? (
              <p className="table-status">No se encontraron inspecciones.</p>
            ) : (
              <>
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
                      {paginatedRows.map(row => (
                        <tr key={row.id_inspeccion}>
                          <td>
                            <strong>{row.folio}</strong>
                            {row.es_dia_siguiente && (
                              <small style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", fontWeight: "600", marginTop: "2px" }}>
                                <IconLuna size={12} /> Día Siguiente ({row.fecha_operativa})
                              </small>
                            )}
                          </td>
                          <td>
                            {row.vehiculo}
                            <small>{row.numero_economico}</small>
                          </td>
                          <td>{row.conductor}</td>
                          <td>{formatDate(row.creado_en)}</td>
                          <td>
                            <span className={`inspection-status inspection-status-${row.estado.toLowerCase()}`}>
                              {row.estado.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            <button className="secondary-button" onClick={() => open(row)}>
                              Ver revisión
                            </button>
                            {row.estado === "APROBADA" && (
                              <button className="secondary-button" onClick={() => descargarAdminInspeccionPdf(row.id_inspeccion)} style={{ marginLeft: "4px" }}>
                                PDF
                              </button>
                            )}
                            {row.sharepoint_web_url && (
                              <a
                                href={row.sharepoint_web_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="secondary-button"
                                style={{ textDecoration: "none", color: "#0284c7", fontWeight: "bold", marginLeft: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                SharePoint
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalFiltered > 0 && (
                  <div className="table-pagination">
                    <span className="pagination-info">
                      Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} inspecciones
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

          {detail && (
            <div className="modal-overlay" onMouseDown={closeDetail}>
              <section className="modal-card inspection-detail-modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: "900px" }}>
                <div className="form-panel-header">
                  <div>
                    <h2>Inspección {detail.folio}</h2>
                    <p>{detail.vehiculo} · {detail.numero_economico}</p>
                  </div>
                  <button className="close-button" onClick={closeDetail}>×</button>
                </div>

                <div className="inspection-detail-grid">
                  <p><strong>Programación:</strong> {detail.es_dia_siguiente ? `Día Siguiente (${detail.fecha_operativa})` : `Día Actual (${detail.fecha_operativa})`}</p>
                  <p><strong>Conductor:</strong> {detail.conductor}</p>
                  <p><strong>Combustible:</strong> {detail.combustible}</p>
                  <p><strong>Asignación:</strong> {detail.tipo_asignacion}</p>
                  <p><strong>Fuera de horario:</strong> {detail.requiere_autorizacion_fuera_horario ? "Sí" : "No"}</p>
                  <p><strong>Póliza:</strong> {detail.numero_poliza || "Sin registro"}</p>
                  <p><strong>Serie:</strong> {detail.numero_serie || "Sin registro"}</p>
                </div>

                <DamageViewer damages={detail.danos} vehicle={detail.vehiculo} />

                <h3 style={{ marginTop: "16px", marginBottom: "8px" }}>Checklist de Verificación por Categoría</h3>
                {renderChecklistByCategories(detail.checklist)}

                <h3>Observaciones</h3>
                <p>{detail.observaciones_conductor || "Sin observaciones."}</p>

                {detail.firma_conductor && (
                  <div>
                    <h4 style={{ margin: "10px 0 6px", fontSize: "0.85rem", color: "#64748b" }}>Firma del conductor:</h4>
                    <img className="admin-signature" src={detail.firma_conductor} alt="Firma del conductor" style={{ maxHeight: "70px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px" }} />
                  </div>
                )}

                {detail.estado === "PENDIENTE_APROBACION" ? (
                  <div className="inspection-decision-panel">
                    <div className="inspection-decision-section">
                      <button type="button" className="secondary-button inspection-preview-button" onClick={openPreview}>
                        Abrir vista previa PDF en nueva pestaña
                      </button>
                    </div>
                    <div className="inspection-decision-section">
                      <label className="inspection-comment-field">
                        <span>Comentario de aprobación</span>
                        <textarea rows="3" value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribe una observación para el conductor (opcional)" />
                      </label>
                    </div>
                    <div className="inspection-decision-section">
                      <ApprovalSignature onChange={setSignature} />
                    </div>
                    <div className="inspection-decision-section form-actions inspection-decision-actions">
                      <button type="button" className="danger-button" disabled={saving} onClick={() => decide(false)}>
                        Rechazar
                      </button>
                      <button type="button" className="primary-button" disabled={saving || !signature} onClick={() => decide(true)}>
                        Aprobar y generar PDF
                      </button>
                    </div>
                  </div>
                ) : detail.estado === "APROBADA" && (
                  <div style={{ marginTop: "16px" }}>
                    <button type="button" className="primary-button" onClick={() => descargarAdminInspeccionPdf(detail.id_inspeccion)}>
                      Descargar reporte PDF
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
