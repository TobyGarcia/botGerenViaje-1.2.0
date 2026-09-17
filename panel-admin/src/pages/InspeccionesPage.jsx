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
import {
  IconInspecciones,
  IconDestinos,
  IconLuna,
  IconBuscar,
  IconVerDetalle,
  IconPdf,
  IconCheck,
  IconAlerta,
  IconCross,
  IconCombustible,
  IconShield,
  IconReloj,
  IconCalendario,
  IconKey,
  IconUser,
  IconUnidades,
  IconExternalLink
} from "../components/Icons.jsx";

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

function formatDateParts(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: String(value), time: "" };
  return {
    date: d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true })
  };
}

function formatFechaOperativa(value) {
  if (!value) return "—";
  try {
    const raw = String(value);
    const dateStr = raw.includes("T") ? raw.split("T")[0] : raw;
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      }
    }
  } catch {
    // fallback
  }
  return value;
}

function StatusBadge({ estado }) {
  const norm = (estado || "").toUpperCase();
  if (norm === "APROBADA") {
    return (
      <span className="status-pill status-pill-approved">
        <span className="status-pill-dot" />
        <IconCheck size={13} strokeWidth={3} />
        Aprobada
      </span>
    );
  }
  if (norm === "PENDIENTE_APROBACION" || norm === "PENDIENTE") {
    return (
      <span className="status-pill status-pill-pending">
        <span className="status-pill-dot pulse" />
        <IconReloj size={13} />
        Por Aprobar
      </span>
    );
  }
  if (norm === "RECHAZADA") {
    return (
      <span className="status-pill status-pill-rejected">
        <IconCross size={13} strokeWidth={3} />
        Rechazada
      </span>
    );
  }
  return (
    <span className="status-pill status-pill-default">
      {estado ? estado.replaceAll("_", " ") : "Sin Estado"}
    </span>
  );
}

function FuelGauge({ value = "" }) {
  const v = (value || "").toLowerCase();
  let percent = 50;
  let levelClass = "fuel-half";
  if (v.includes("1/4") || v.includes("reserva") || v.includes("vacio") || v.includes("vacío")) {
    percent = 25;
    levelClass = "fuel-low";
  } else if (v.includes("1/2")) {
    percent = 50;
    levelClass = "fuel-half";
  } else if (v.includes("3/4")) {
    percent = 75;
    levelClass = "fuel-good";
  } else if (v.includes("lleno") || v.includes("full") || v.includes("4/4") || v.includes("1/1")) {
    percent = 100;
    levelClass = "fuel-full";
  }

  return (
    <div className="fuel-gauge-container">
      <div className="fuel-gauge-bar">
        <div className={`fuel-gauge-fill ${levelClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="fuel-gauge-legend">
        <span className="fuel-gauge-text">{value || "No especificado"}</span>
        <span className="fuel-gauge-percent">{percent}%</span>
      </div>
    </div>
  );
}

function renderChecklistByCategories(checklist = {}) {
  const entries = Object.entries(checklist);
  const goodCount = entries.filter(([, s]) => s === "B").length;
  const regularCount = entries.filter(([, s]) => s === "R").length;
  const badCount = entries.filter(([, s]) => s === "M").length;
  const naCount = entries.filter(([, s]) => s === "N/A" || s === "NA").length;
  const totalCount = entries.length;

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
    <div className="enhanced-checklist-section">
      <div className="checklist-summary-bar">
        <div className="checklist-summary-total">
          <strong>{totalCount}</strong> puntos verificados
        </div>
        <div className="checklist-summary-tags">
          <span className="summary-pill summary-pill-good">
            <IconCheck size={13} /> {goodCount} Buen estado
          </span>
          {regularCount > 0 && (
            <span className="summary-pill summary-pill-regular">
              <IconAlerta size={13} /> {regularCount} Regular
            </span>
          )}
          {badCount > 0 && (
            <span className="summary-pill summary-pill-bad">
              <IconCross size={13} /> {badCount} Mal estado
            </span>
          )}
          {naCount > 0 && (
            <span className="summary-pill summary-pill-na">
              {naCount} N/A
            </span>
          )}
        </div>
      </div>

      <div className="checklist-cards-grid">
        {categories.map(({ groupName, items }) => (
          <div key={groupName} className="checklist-card">
            <div className="checklist-card-header">
              <span className="checklist-card-title">{groupName}</span>
              <span className="checklist-card-count">{items.length} elementos</span>
            </div>
            <div className="checklist-card-body">
              {items.map(([item, state]) => (
                <div key={item} className="checklist-item-row">
                  <span className="checklist-item-name">{item}</span>
                  <span
                    className={`checklist-badge checklist-badge-${
                      state === "B" ? "good" : state === "R" ? "regular" : state === "M" ? "bad" : "na"
                    }`}
                    title={
                      state === "B"
                        ? "Buen Estado"
                        : state === "R"
                        ? "Estado Regular"
                        : state === "M"
                        ? "Mal Estado"
                        : "No Aplica"
                    }
                  >
                    {state === "B" ? "BUENO" : state === "R" ? "REGULAR" : state === "M" ? "MALO" : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
    onChange("");
  }

  return (
    <section className="approval-signature">
      <label>
        <span>Firma digital de aprobación</span>
        <canvas
          ref={canvasRef}
          width="640"
          height="200"
          aria-label="Firma de aprobación"
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </label>
      <div className="signature-actions">
        <button type="button" className="btn-clean-signature" disabled={!hasSignature} onClick={clear}>
          Limpiar firma
        </button>
        <small className={hasSignature ? "sig-status-ok" : "sig-status-pending"}>
          {hasSignature ? "Firma capturada correctamente." : "Firma requerida para autorizar."}
        </small>
      </div>
    </section>
  );
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  async function load() {
    setLoading(true);
    try {
      const response = await getAdminInspecciones();
      const data = response.data || [];
      setRows(data);
      onPendingChange?.(data.filter(item => item.estado === "PENDIENTE_APROBACION").length);
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

  // Conteos para filtros rápidos
  const pendingCount = rows.filter(r => r.estado === "PENDIENTE_APROBACION").length;
  const approvedCount = rows.filter(r => r.estado === "APROBADA").length;
  const rejectedCount = rows.filter(r => r.estado === "RECHAZADA").length;

  const filteredRows = rows.filter((r) => {
    if (statusFilter !== "ALL" && r.estado !== statusFilter) return false;
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

      {/* Sub-pestañas estilizadas */}
      <div className="logistics-nav-tabs">
        <button
          type="button"
          onClick={() => { setActiveTab("inspecciones"); setCurrentPage(1); }}
          className={`logistics-tab-btn ${activeTab === "inspecciones" ? "active" : ""}`}
        >
          <IconInspecciones size={18} />
          <span>Inspecciones Vehiculares</span>
          {pendingCount > 0 && (
            <span className="tab-pending-badge" title={`${pendingCount} inspecciones por aprobar`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("gerenciamiento"); setCurrentPage(1); }}
          className={`logistics-tab-btn tab-btn-gerenciamiento ${activeTab === "gerenciamiento" ? "active" : ""}`}
        >
          <IconDestinos size={18} />
          <span>Gerenciamiento de Viajes</span>
        </button>
      </div>

      {activeTab === "gerenciamiento" ? (
        <GerenciamientoAdminPage user={user} />
      ) : (
        <>
          {/* Barra de herramientas con buscador y filtros rápidos */}
          <section className="inspections-toolbar">
            <div className="search-box-enhanced">
              <IconBuscar size={18} className="search-box-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por folio, conductor, unidad o número económico..."
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch("")}
                  title="Limpiar búsqueda"
                >
                  <IconCross size={14} />
                </button>
              )}
            </div>

            <div className="status-filter-group">
              <button
                type="button"
                className={`status-filter-chip ${statusFilter === "ALL" ? "chip-active" : ""}`}
                onClick={() => { setStatusFilter("ALL"); setCurrentPage(1); }}
              >
                Todas <span>({rows.length})</span>
              </button>
              <button
                type="button"
                className={`status-filter-chip chip-pending ${statusFilter === "PENDIENTE_APROBACION" ? "chip-active" : ""}`}
                onClick={() => { setStatusFilter("PENDIENTE_APROBACION"); setCurrentPage(1); }}
              >
                Por Aprobar <span>({pendingCount})</span>
              </button>
              <button
                type="button"
                className={`status-filter-chip chip-approved ${statusFilter === "APROBADA" ? "chip-active" : ""}`}
                onClick={() => { setStatusFilter("APROBADA"); setCurrentPage(1); }}
              >
                Aprobadas <span>({approvedCount})</span>
              </button>
              {rejectedCount > 0 && (
                <button
                  type="button"
                  className={`status-filter-chip chip-rejected ${statusFilter === "RECHAZADA" ? "chip-active" : ""}`}
                  onClick={() => { setStatusFilter("RECHAZADA"); setCurrentPage(1); }}
                >
                  Rechazadas <span>({rejectedCount})</span>
                </button>
              )}
            </div>
          </section>

          {message && <p className="module-message">{message}</p>}

          <section className="table-panel inspections-table-card">
            {loading ? (
              <div className="table-loading-state">
                <div className="spinner-dot" />
                <p>Cargando inspecciones vehiculares...</p>
              </div>
            ) : paginatedRows.length === 0 ? (
              <div className="table-empty-state">
                <IconInspecciones size={40} className="empty-icon" />
                <h4>No se encontraron inspecciones</h4>
                <p>Intenta ajustar el término de búsqueda o el filtro de estado seleccionado.</p>
              </div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="admin-table inspections-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Unidad / No. Eco</th>
                        <th>Conductor</th>
                        <th>Fecha de Envío</th>
                        <th>Estado</th>
                        <th style={{ textAlign: "right", paddingRight: "20px" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map(row => {
                        const { date, time } = formatDateParts(row.creado_en);
                        return (
                          <tr key={row.id_inspeccion} className="inspection-row">
                            <td>
                              <div className="folio-cell">
                                <span className="folio-code">{row.folio}</span>
                                {row.es_dia_siguiente && (
                                  <span className="next-day-pill" title={`Programada para: ${row.fecha_operativa}`}>
                                    <IconLuna size={12} /> Día Siguiente
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="vehicle-cell">
                                <span className="vehicle-name">{row.vehiculo}</span>
                                <span className="vehicle-eco-tag">{row.numero_economico}</span>
                              </div>
                            </td>
                            <td>
                              <div className="driver-cell">
                                <span className="driver-name">{row.conductor}</span>
                              </div>
                            </td>
                            <td>
                              <div className="date-cell">
                                <span className="date-main">{date}</span>
                                <span className="date-sub">{time}</span>
                              </div>
                            </td>
                            <td>
                              <StatusBadge estado={row.estado} />
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  type="button"
                                  className="btn-table-action btn-review"
                                  onClick={() => open(row)}
                                  title="Ver detalle de la revisión"
                                >
                                  <IconVerDetalle size={15} />
                                  <span>Ver revisión</span>
                                </button>
                                {row.estado === "APROBADA" && (
                                  <button
                                    type="button"
                                    className="btn-table-action btn-pdf"
                                    onClick={() => descargarAdminInspeccionPdf(row.id_inspeccion)}
                                    title="Descargar reporte PDF"
                                  >
                                    <IconPdf size={15} />
                                    <span>PDF</span>
                                  </button>
                                )}
                                {row.sharepoint_web_url && (
                                  <a
                                    href={row.sharepoint_web_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-table-action btn-sharepoint"
                                    title="Abrir en SharePoint"
                                  >
                                    <IconExternalLink size={13} />
                                    <span>SharePoint</span>
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalFiltered > 0 && (
                  <div className="table-pagination enhanced-pagination">
                    <span className="pagination-info">
                      Mostrando <strong>{Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)}</strong> a{" "}
                      <strong>{Math.min(currentPage * itemsPerPage, totalFiltered)}</strong> de{" "}
                      <strong>{totalFiltered}</strong> inspecciones
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

          {/* Modal de Detalle de Inspección */}
          {detail && (
            <div className="modal-overlay" onMouseDown={closeDetail}>
              <section
                className="modal-card inspection-detail-modal-enhanced"
                onMouseDown={e => e.stopPropagation()}
              >
                {/* Cabecera del modal */}
                <div className="modal-top-header">
                  <div className="modal-header-info">
                    <div className="modal-title-row">
                      <h2>Inspección {detail.folio}</h2>
                      <StatusBadge estado={detail.estado} />
                    </div>
                    <div className="modal-subtitle-row">
                      <span className="vehicle-pill">
                        <IconUnidades size={14} /> {detail.vehiculo}
                      </span>
                      <span className="eco-pill">{detail.numero_economico}</span>
                      {detail.es_dia_siguiente && (
                        <span className="next-day-tag">
                          <IconLuna size={12} /> Día Siguiente
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="modal-header-actions">
                    {detail.estado === "APROBADA" && (
                      <button
                        type="button"
                        className="btn-header-pdf"
                        onClick={() => descargarAdminInspeccionPdf(detail.id_inspeccion)}
                        title="Descargar documento PDF"
                      >
                        <IconPdf size={16} />
                        <span>Descargar PDF</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="close-modal-btn"
                      onClick={closeDetail}
                      title="Cerrar modal"
                    >
                      <IconCross size={18} />
                    </button>
                  </div>
                </div>

                {/* Contenido scrolleable del modal */}
                <div className="modal-scroll-body">
                  {/* Grid de Tarjetas Informativas */}
                  <div className="info-cards-grid">
                    {/* Tarjeta Programación */}
                    <div className="info-card">
                      <div className="info-card-icon icon-blue">
                        <IconCalendario size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Programación</span>
                        <strong className="info-card-value">
                          {detail.es_dia_siguiente ? "Día Siguiente" : "Día Actual"}
                        </strong>
                        <small className="info-card-sub">
                          {formatFechaOperativa(detail.fecha_operativa)}
                        </small>
                      </div>
                    </div>

                    {/* Tarjeta Conductor */}
                    <div className="info-card">
                      <div className="info-card-icon icon-cyan">
                        <IconUser size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Conductor Asignado</span>
                        <strong className="info-card-value">{detail.conductor}</strong>
                        <small className="info-card-sub">Operador autorizado</small>
                      </div>
                    </div>

                    {/* Tarjeta Combustible */}
                    <div className="info-card">
                      <div className="info-card-icon icon-amber">
                        <IconCombustible size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Nivel de Combustible</span>
                        <FuelGauge value={detail.combustible} />
                      </div>
                    </div>

                    {/* Tarjeta Asignación */}
                    <div className="info-card">
                      <div className="info-card-icon icon-indigo">
                        <IconKey size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Tipo de Asignación</span>
                        <strong className="info-card-value">{detail.tipo_asignacion || "Sin registro"}</strong>
                        <small className="info-card-sub">Modalidad vehicular</small>
                      </div>
                    </div>

                    {/* Tarjeta Fuera de Horario */}
                    <div className="info-card">
                      <div className="info-card-icon icon-emerald">
                        <IconReloj size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Horario Operativo</span>
                        <strong className="info-card-value">
                          {detail.requiere_autorizacion_fuera_horario ? "Fuera de Horario" : "Horario Habitual"}
                        </strong>
                        <small className="info-card-sub">
                          {detail.requiere_autorizacion_fuera_horario ? "Requiere autorización" : "En jornada normal"}
                        </small>
                      </div>
                    </div>

                    {/* Tarjeta Póliza de Seguro */}
                    <div className="info-card">
                      <div className="info-card-icon icon-purple">
                        <IconShield size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Póliza de Seguro</span>
                        <strong className="info-card-value font-mono">
                          {detail.numero_poliza || "Sin póliza registrada"}
                        </strong>
                        <small className="info-card-sub">Aseguradora vigente</small>
                      </div>
                    </div>

                    {/* Tarjeta Número de Serie */}
                    <div className="info-card">
                      <div className="info-card-icon icon-slate">
                        <IconUnidades size={18} />
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-label">Número de Serie (VIN)</span>
                        <strong className="info-card-value font-mono">
                          {detail.numero_serie || "Sin serie registrada"}
                        </strong>
                        <small className="info-card-sub">Identificación de chasis</small>
                      </div>
                    </div>
                  </div>

                  {/* Sección de Daños */}
                  <div className="modal-section-card">
                    <DamageViewer damages={detail.danos} vehicle={detail.vehiculo} />
                  </div>

                  {/* Checklist por Categorías */}
                  <div className="modal-section-card">
                    <div className="section-card-title">
                      <h3>Checklist de Verificación Vehicular</h3>
                      <p>Inspección integral de sistemas mecánicos, seguridad y documentación obligatoria.</p>
                    </div>
                    {renderChecklistByCategories(detail.checklist)}
                  </div>

                  {/* Observaciones del Conductor */}
                  <div className="modal-section-card">
                    <div className="section-card-title">
                      <h3>Observaciones del Conductor</h3>
                    </div>
                    <div className="observations-callout">
                      <p>{detail.observaciones_conductor || "El conductor no reportó ninguna observación adicional durante la inspección."}</p>
                    </div>
                  </div>

                  {/* Firma del Conductor */}
                  {detail.firma_conductor && (
                    <div className="modal-section-card">
                      <div className="section-card-title">
                        <h3>Constancia de Firma del Conductor</h3>
                        <p>Firma digital estampada al completar la inspección en el bot móvil.</p>
                      </div>
                      <div className="driver-signature-box">
                        <img
                          className="driver-signature-img"
                          src={detail.firma_conductor}
                          alt="Firma del conductor"
                        />
                        <div className="driver-signature-meta">
                          <span>Conductor: <strong>{detail.conductor}</strong></span>
                          <small><IconCheck size={13} /> Verificado mediante Telegram Bot</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel de Decisión (si está pendiente de aprobación) */}
                  {detail.estado === "PENDIENTE_APROBACION" ? (
                    <div className="modal-section-card decision-panel-card">
                      <div className="section-card-title">
                        <h3>Dictamen de Aprobación de Inspección</h3>
                        <p>Como supervisor, revisa los datos y firma para autorizar la operación del vehículo.</p>
                      </div>

                      <div className="decision-preview-box">
                        <button
                          type="button"
                          className="btn-preview-pdf"
                          onClick={openPreview}
                        >
                          <IconPdf size={16} />
                          <span>Abrir vista previa del PDF en nueva pestaña</span>
                        </button>
                      </div>

                      <div className="decision-comment-box">
                        <label>
                          <span>Comentario de Aprobación / Observaciones del Supervisor</span>
                          <textarea
                            rows="3"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Escribe una observación para el conductor (opcional)..."
                          />
                        </label>
                      </div>

                      <div className="decision-signature-box">
                        <ApprovalSignature onChange={setSignature} />
                      </div>

                      <div className="decision-actions-row">
                        <button
                          type="button"
                          className="btn-decision-reject"
                          disabled={saving}
                          onClick={() => decide(false)}
                        >
                          <IconCross size={16} />
                          <span>Rechazar Inspección</span>
                        </button>
                        <button
                          type="button"
                          className="btn-decision-approve"
                          disabled={saving || !signature}
                          onClick={() => decide(true)}
                        >
                          <IconCheck size={16} />
                          <span>Aprobar y Generar PDF Oficial</span>
                        </button>
                      </div>
                    </div>
                  ) : detail.estado === "APROBADA" && (
                    <div className="modal-section-card approved-footer-card">
                      <div className="approved-footer-content">
                        <div>
                          <h4>Inspección Aprobada Oficialmente</h4>
                          <p>Esta inspección vehicular cuenta con dictamen favorable y reporte generado.</p>
                        </div>
                        <button
                          type="button"
                          className="btn-download-pdf-large"
                          onClick={() => descargarAdminInspeccionPdf(detail.id_inspeccion)}
                        >
                          <IconPdf size={18} />
                          <span>Descargar Reporte PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}

