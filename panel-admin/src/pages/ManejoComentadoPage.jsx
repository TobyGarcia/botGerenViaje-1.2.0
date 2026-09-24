import { useEffect, useState } from "react";
import {
  getManejoComentadoConductores,
  programarCursoManejoComentado,
  renovarManejoComentadoDirecto,
  getCursosManejoComentado,
  updateManejoComentadoConductor
} from "../services/api.js";
import {
  IconCalendario,
  IconDispositivo,
  IconReloj,
  IconEditar
} from "../components/Icons.jsx";

function calculateProximaEvaluacionDate(scoreVal, fechaRealizVal) {
  if (!fechaRealizVal) return "";
  const num = Number(scoreVal || 0);
  let dias = 0;
  if (num >= 85) dias = 365;
  else if (num >= 75) dias = 180;
  else if (num >= 50) dias = 90;
  else dias = 30;

  const dateMatch = String(fechaRealizVal).match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return "";
  const [y, m, d] = dateMatch[0].split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value) {
  if (!value) return "Sin registro";
  const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return "Fecha no válida";
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getBadgeClass(estado) {
  switch (estado) {
    case "VIGENTE":
      return "status-badge status-active";
    case "PROXIMO_A_VENCER":
    case "PENDIENTE":
      return "status-badge status-pending";
    case "VENCIDO":
    case "SIN_REGISTRO":
    case "REPROBADO":
      return "status-badge status-inactive";
    default:
      return "status-badge";
  }
}

function getBadgeLabel(estado, dias) {
  switch (estado) {
    case "VIGENTE":
      return `Vigente (${dias} días)`;
    case "PROXIMO_A_VENCER":
      return `Próximo a vencer (${dias} días)`;
    case "VENCIDO":
      return `Vencido (hace ${Math.abs(dias)} días)`;
    case "PENDIENTE":
      return "Cálculo Pendiente";
    case "REPROBADO":
      return "Reprobado";
    case "SIN_REGISTRO":
      return "Sin registro";
    default:
      return estado;
  }
}

function calculateScoreFromDates(fechaRealizVal, proximaEvVal) {
  if (!fechaRealizVal || !proximaEvVal) return null;
  const matchR = String(fechaRealizVal).match(/^\d{4}-\d{2}-\d{2}/);
  const matchP = String(proximaEvVal).match(/^\d{4}-\d{2}-\d{2}/);
  if (!matchR || !matchP) return null;

  const [yr, mr, dr] = matchR[0].split("-").map(Number);
  const [yp, mp, dp] = matchP[0].split("-").map(Number);
  const dateR = new Date(yr, mr - 1, dr);
  const dateP = new Date(yp, mp - 1, dp);

  const diffMs = dateP.getTime() - dateR.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "0";
  if (diffDays >= 270) {
    return "100";
  } else if (diffDays >= 135) {
    return "80";
  } else if (diffDays >= 45) {
    return "70";
  } else {
    return "40";
  }
}

function getPreviewVigencia(calificacion, fechaEvaluacion, proximaEvaluacion = null) {
  const score = Number(calificacion || 0);
  let dias = 0;
  let label = "";
  let aprobado = true;

  if (score >= 85) {
    dias = 365;
    label = "365 días (1 año)";
  } else if (score >= 75) {
    dias = 180;
    label = "180 días (6 meses)";
  } else if (score >= 50) {
    dias = 90;
    label = "90 días (3 meses)";
  } else {
    dias = 0;
    label = "Reprobado (re-evaluación al siguiente mes)";
    aprobado = false;
  }

  if (proximaEvaluacion) {
    const pMatch = String(proximaEvaluacion).match(/^\d{4}-\d{2}-\d{2}/);
    if (pMatch) {
      const [yp, mp, dp] = pMatch[0].split("-").map(Number);
      const customExpiryStr = new Date(yp, mp - 1, dp).toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
      return { aprobado, label, fechaVencimiento: customExpiryStr };
    }
  }

  if (!aprobado || !fechaEvaluacion) {
    return { aprobado, label, fechaVencimiento: null };
  }

  const dateMatch = String(fechaEvaluacion).match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return { aprobado, label, fechaVencimiento: null };

  const [y, m, d] = dateMatch[0].split("-").map(Number);
  const evalDate = new Date(y, m - 1, d);
  evalDate.setDate(evalDate.getDate() + dias);
  const expiryStr = evalDate.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });

  return { aprobado, label, fechaVencimiento: expiryStr };
}

export default function ManejoComentadoPage({ user }) {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("cursos")) return "cursos";
    try {
      const saved = sessionStorage.getItem("gv_admin_mc_tab");
      if (saved === "cursos" || saved === "conductores") return saved;
    } catch {}
    return "conductores";
  });
  const [conductores, setConductores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [currentCondPage, setCurrentCondPage] = useState(1);
  const [currentCursoPage, setCurrentCursoPage] = useState(1);
  const itemsPerPage = 20;

  // Modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConductor, setEditingConductor] = useState(null);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showProgramarModal, setShowProgramarModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulario Edición (Solo datos de manejo comentado)
  const [editForm, setEditForm] = useState({
    idConductor: "",
    fechaRealizacion: "",
    score: "100",
    proximaEvaluacion: "",
    comentarios: ""
  });

  // Formulario Renovación
  const [renovarForm, setRenovarForm] = useState({
    idConductor: "",
    fechaEvaluacion: new Date().toISOString().slice(0, 10),
    calificacion: "100",
    estadoEvaluacion: "APROBADO",
    comentarios: ""
  });

  // Formulario Programación Curso
  const [cursoForm, setCursoForm] = useState({
    titulo: "Curso de Manejo Comentado y Prevención de Riesgos",
    fechaCursoOral: new Date().toISOString().slice(0, 10),
    fechaEvaluacionInicio: new Date().toISOString().slice(0, 10),
    fechaEvaluacionFin: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    idConductores: [],
    notas: ""
  });

  async function loadData() {
    setLoading(true);
    try {
      const [resCond, resCur] = await Promise.all([
        getManejoComentadoConductores({ search, status: filterStatus }),
        getCursosManejoComentado()
      ]);
      setConductores(resCond.data || []);
      setCursos(resCur.data || []);
    } catch (err) {
      setMessage(err.message || "Error al cargar datos.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, filterStatus]);

  function handleOpenEditModal(conductor) {
    setEditingConductor(conductor);
    const rawFechaRealiz = conductor.fecha_manejo_comentado
      ? String(conductor.fecha_manejo_comentado).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    let rawScore = conductor.score !== null && conductor.score !== undefined ? String(conductor.score) : "";
    let rawProximaEv = conductor.fecha_vencimiento ? String(conductor.fecha_vencimiento).slice(0, 10) : "";

    // Si no tiene score o es 0 pero tiene próxima evaluación, calcular calificación según la diferencia de fechas
    if ((!rawScore || rawScore === "0") && rawProximaEv && rawFechaRealiz) {
      const calcScore = calculateScoreFromDates(rawFechaRealiz, rawProximaEv);
      if (calcScore) rawScore = calcScore;
    }

    if (!rawScore) rawScore = "100";

    if (!rawProximaEv && rawFechaRealiz) {
      rawProximaEv = calculateProximaEvaluacionDate(rawScore, rawFechaRealiz);
    }

    setEditForm({
      idConductor: conductor.id_conductores,
      fechaRealizacion: rawFechaRealiz,
      score: rawScore,
      proximaEvaluacion: rawProximaEv,
      comentarios: conductor.ultima_evaluacion?.comentarios || ""
    });
    setShowEditModal(true);
  }

  function handleEditScoreChange(val) {
    const newProx = calculateProximaEvaluacionDate(val, editForm.fechaRealizacion);
    setEditForm((prev) => ({
      ...prev,
      score: val,
      proximaEvaluacion: newProx || prev.proximaEvaluacion
    }));
  }

  function handleEditFechaRealizacionChange(val) {
    const newProx = calculateProximaEvaluacionDate(editForm.score, val);
    setEditForm((prev) => ({
      ...prev,
      fechaRealizacion: val,
      proximaEvaluacion: newProx || prev.proximaEvaluacion
    }));
  }

  function handleEditProximaEvaluacionChange(val) {
    const calcScore = calculateScoreFromDates(editForm.fechaRealizacion, val);
    setEditForm((prev) => ({
      ...prev,
      proximaEvaluacion: val,
      score: calcScore !== null ? calcScore : prev.score
    }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.idConductor) return;
    setSaving(true);
    setMessage("");

    try {
      await updateManejoComentadoConductor(editForm.idConductor, {
        fechaRealizacion: editForm.fechaRealizacion,
        score: editForm.score,
        proximaEvaluacion: editForm.proximaEvaluacion,
        comentarios: editForm.comentarios
      });
      setMessage("Datos de manejo comentado actualizados correctamente.");
      setMessageType("success");
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al actualizar manejo comentado.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenovarSubmit(e) {
    e.preventDefault();
    if (!renovarForm.idConductor) return;
    setSaving(true);
    setMessage("");

    try {
      await renovarManejoComentadoDirecto(renovarForm);
      setMessage("Manejo comentado renovado y registrado correctamente.");
      setMessageType("success");
      setShowRenovarModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al renovar.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleProgramarSubmit(e) {
    e.preventDefault();
    if (cursoForm.idConductores.length === 0) {
      setMessage("Debes seleccionar al menos un conductor para el curso.");
      setMessageType("error");
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      await programarCursoManejoComentado(cursoForm);
      setMessage("Curso de Manejo Comentado programado y notificado al grupo de Telegram.");
      setMessageType("success");
      setShowProgramarModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al programar curso.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectConductorRenovar(conductor) {
    setRenovarForm({
      idConductor: conductor.id_conductores,
      fechaEvaluacion: new Date().toISOString().slice(0, 10),
      calificacion: "100",
      estadoEvaluacion: "APROBADO",
      comentarios: `Renovación semestral de manejo comentado para ${conductor.nombre}`
    });
    setShowRenovarModal(true);
  }

  function toggleDriverSelection(id) {
    setCursoForm((prev) => {
      const exists = prev.idConductores.includes(id);
      return {
        ...prev,
        idConductores: exists
          ? prev.idConductores.filter((item) => item !== id)
          : [...prev.idConductores, id]
      };
    });
  }

  function selectAllDrivers() {
    setCursoForm((prev) => ({
      ...prev,
      idConductores: conductores.map((c) => c.id_conductores)
    }));
  }

  function deselectAllDrivers() {
    setCursoForm((prev) => ({ ...prev, idConductores: [] }));
  }

  const canManage = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"].includes(user.rol);

  const totalFilteredCond = conductores.length;
  const totalPagesCond = Math.max(1, Math.ceil(totalFilteredCond / itemsPerPage));
  const paginatedConductores = conductores.slice(
    (currentCondPage - 1) * itemsPerPage,
    currentCondPage * itemsPerPage
  );

  const totalFilteredCursos = cursos.length;
  const totalPagesCursos = Math.max(1, Math.ceil(totalFilteredCursos / itemsPerPage));
  const paginatedCursos = cursos.slice(
    (currentCursoPage - 1) * itemsPerPage,
    currentCursoPage * itemsPerPage
  );

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Capacitación Vial</span>
          <h1>Manejo Comentado</h1>
          <p>
            Vigencia de evaluaciones prácticas, programación de cursos teóricos
            y registro de acreditaciones.
          </p>
        </div>

        <div className="module-header-actions">
          {canManage && (
            <>
              <a
                href="/evaluacion"
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconDispositivo size={16} /> Aplicativo Móvil (/evaluacion)
              </a>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowRenovarModal(true)}
              >
                + Renovar Directo
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => setShowProgramarModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconCalendario size={16} /> Programar Curso
              </button>
            </>
          )}
        </div>
      </header>

      {message && (
        <div className={`module-message module-message-${messageType}`} style={{ marginBottom: "1rem" }}>
          {message}
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className="ranking-segmented-control" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className={`ranking-tab-btn ${activeTab === "conductores" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("conductores");
            try { sessionStorage.setItem("gv_admin_mc_tab", "conductores"); } catch {}
          }}
        >
          Conductores y Vigencias
        </button>
        <button
          type="button"
          className={`ranking-tab-btn ${activeTab === "cursos" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("cursos");
            try { sessionStorage.setItem("gv_admin_mc_tab", "cursos"); } catch {}
          }}
        >
          Cursos Programados ({cursos.length})
        </button>
      </div>

      {activeTab === "conductores" && (
        <>
          <section className="module-toolbar" style={{ marginBottom: "20px" }}>
            <label className="search-field">
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nombre, licencia o teléfono"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentCondPage(1);
                }}
              />
            </label>

            <label className="status-filter">
              <span>Estado</span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentCondPage(1);
                }}
              >
                <option value="TODOS">Todos los estatus</option>
                <option value="VIGENTE">Vigentes (&gt; 30 días)</option>
                <option value="PROXIMO_A_VENCER">Próximos a vencer (&lt;= 30 días)</option>
                <option value="VENCIDO">Vencidos</option>
                <option value="SIN_REGISTRO">Sin registro</option>
              </select>
            </label>
          </section>

          <section className="table-panel">
            {loading ? (
              <p className="table-status">Cargando estado de manejo comentado...</p>
            ) : conductores.length === 0 ? (
              <p className="table-status">No se encontraron conductores con el filtro seleccionado.</p>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="admin-table" style={{ minWidth: "1150px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "45px", textAlign: "center" }}>ID</th>
                        <th>Nombre Completo</th>
                        <th>Teléfono</th>
                        <th>Licencia</th>
                        <th>Vencimiento de Licencia</th>
                        <th>Tipo de licencia</th>
                        <th>Fecha realiz</th>
                        <th>Próxima Ev.</th>
                        <th style={{ textAlign: "center" }}>Score de Manejo Comentado</th>
                        <th>Estatus</th>
                        <th style={{ textAlign: "center", width: "190px" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedConductores.map((conductor) => (
                        <tr key={conductor.id_conductores}>
                          <td style={{ textAlign: "center", fontWeight: "600", color: "#607986" }}>
                            {conductor.id_conductores}
                          </td>
                          <td>
                            <strong>{conductor.nombre}</strong>
                            {conductor.empresa && (
                              <small style={{ display: "block", color: "#607986" }}>{conductor.empresa}</small>
                            )}
                          </td>
                          <td>{conductor.telefono || "Sin registro"}</td>
                          <td>{conductor.licencia_numero || "Sin registro"}</td>
                          <td>{formatDate(conductor.licencia_vencimiento)}</td>
                          <td>{conductor.tipo_licencia || "Automovilista"}</td>
                          <td>{formatDate(conductor.fecha_manejo_comentado)}</td>
                          <td>
                            <strong style={{ color: conductor.estado_vigencia === "VENCIDO" ? "#dc2626" : conductor.estado_vigencia === "PROXIMO_A_VENCER" ? "#d97706" : "#166534" }}>
                              {formatDate(conductor.fecha_vencimiento)}
                            </strong>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {conductor.score !== null && conductor.score !== undefined ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontWeight: "700",
                                  fontSize: "0.85rem",
                                  backgroundColor: conductor.score >= 85 ? "#e4f7ed" : conductor.score >= 70 ? "#fff0c9" : "#fae8e8",
                                  color: conductor.score >= 85 ? "#12643e" : conductor.score >= 70 ? "#7a560b" : "#8a3030"
                                }}
                              >
                                {conductor.score}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={getBadgeClass(conductor.estado_vigencia)}>
                              {getBadgeLabel(conductor.estado_vigencia, conductor.dias_para_vencer)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                              {canManage && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: "5px 10px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => handleOpenEditModal(conductor)}
                                  title="Editar manejo comentado"
                                >
                                  <IconEditar size={13} /> Editar
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "5px 10px", fontSize: "0.82rem" }}
                                onClick={() => handleSelectConductorRenovar(conductor)}
                                title="Renovar directo"
                              >
                                Renovar
                              </button>
                              <a
                                href="/evaluacion"
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{ padding: "5px 10px", fontSize: "0.82rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                title="Evaluar desde la app móvil"
                              >
                                <IconDispositivo size={13} /> Móvil
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalFilteredCond > 0 && (
                  <div className="table-pagination">
                    <span className="pagination-info">
                      Mostrando {Math.min((currentCondPage - 1) * itemsPerPage + 1, totalFilteredCond)} - {Math.min(currentCondPage * itemsPerPage, totalFilteredCond)} de {totalFilteredCond} conductores
                    </span>
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentCondPage((p) => Math.max(1, p - 1))}
                        disabled={currentCondPage === 1}
                      >
                        Anterior
                      </button>
                      <span className="pagination-page-indicator">
                        Página {currentCondPage} de {totalPagesCond}
                      </span>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentCondPage((p) => Math.min(totalPagesCond, p + 1))}
                        disabled={currentCondPage === totalPagesCond}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {activeTab === "cursos" && (
        <section className="table-panel">
          {cursos.length === 0 ? (
            <p className="table-status">No hay cursos de manejo comentado agendados.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Fecha Oral</th>
                      <th>Ventana Evaluación Práctica</th>
                      <th>Instructor</th>
                      <th>Programado por</th>
                      <th>Estatus Participantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCursos.map((c) => (
                      <tr key={c.id_curso}>
                        <td>
                          <strong>{c.titulo}</strong>
                          {c.notas && <small style={{ display: "block", color: "#607986" }}>{c.notas}</small>}
                        </td>
                        <td>{formatDate(c.fecha_curso_oral)}</td>
                        <td>
                          {formatDate(c.fecha_evaluacion_inicio)} al {formatDate(c.fecha_evaluacion_fin)}
                        </td>
                        <td>{c.instructor_nombre || "Sin asignar"}</td>
                        <td>{c.programador_nombre || "Admin"}</td>
                        <td>
                          <span className="status-badge status-active" style={{ marginRight: "4px" }}>
                            Total: {c.total_participantes}
                          </span>
                          <span className="status-badge status-active" style={{ marginRight: "4px", backgroundColor: "#e4f7ed", color: "#12643e" }}>
                            Aprobados: {c.aprobados}
                          </span>
                          <span className="status-badge status-inactive">
                            Pendientes: {c.pendientes}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalFilteredCursos > 0 && (
                <div className="table-pagination">
                  <span className="pagination-info">
                    Mostrando {Math.min((currentCursoPage - 1) * itemsPerPage + 1, totalFilteredCursos)} - {Math.min(currentCursoPage * itemsPerPage, totalFilteredCursos)} de {totalFilteredCursos} cursos
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentCursoPage((p) => Math.max(1, p - 1))}
                      disabled={currentCursoPage === 1}
                    >
                      Anterior
                    </button>
                    <span className="pagination-page-indicator">
                      Página {currentCursoPage} de {totalPagesCursos}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentCursoPage((p) => Math.min(totalPagesCursos, p + 1))}
                      disabled={currentCursoPage === totalPagesCursos}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Modal Editar Manejo Comentado */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "660px", maxHeight: "92vh", overflowY: "auto" }}>
            <h2>Editar Manejo Comentado</h2>
            <p style={{ color: "#607986", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
              Actualiza la fecha de realización, calificación y próxima evaluación del conductor.
            </p>

            {/* Ficha informativa del conductor (Solo Lectura) */}
            {editingConductor && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2edf2",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "1.25rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.95rem" }}>
                    {editingConductor.nombre} {editingConductor.empresa ? `(${editingConductor.empresa})` : ""}
                  </span>
                  <span style={{ fontSize: "0.75rem", background: "#e2edf2", color: "#475569", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" }}>
                    ID: #{editingConductor.id_conductores} (Solo Lectura)
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", fontSize: "0.82rem", color: "#475569" }}>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Teléfono:</span>
                    <strong>{editingConductor.telefono || "Sin registro"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Licencia:</span>
                    <strong>{editingConductor.licencia_numero || "Sin registro"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Venc. Licencia:</span>
                    <strong>{formatDate(editingConductor.licencia_vencimiento)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Tipo Licencia:</span>
                    <strong>{editingConductor.tipo_licencia || "Automovilista"}</strong>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label>Fecha realiz (Realización) *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.fechaRealizacion}
                    onChange={(e) => handleEditFechaRealizacionChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Score (0 - 100) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control"
                    value={editForm.score}
                    onChange={(e) => handleEditScoreChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Próxima Ev. (Evaluación)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.proximaEvaluacion}
                    onChange={(e) => handleEditProximaEvaluacionChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Cálculo dinámico de la vigencia */}
              {(() => {
                const preview = getPreviewVigencia(editForm.score, editForm.fechaRealizacion, editForm.proximaEvaluacion);
                return (
                  <div
                    style={{
                      background: preview.aprobado ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${preview.aprobado ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: "8px",
                      padding: "10px 14px",
                      marginBottom: "1rem",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div style={{ fontWeight: "600", color: preview.aprobado ? "#166534" : "#991b1b" }}>
                      Cálculo de Vigencia Asignada: {preview.label}
                    </div>
                    <div style={{ marginTop: "3px", color: "#475569" }}>
                      Próxima fecha sugerida: {preview.fechaVencimiento || "Pendiente"} (puedes ajustar la fecha manualmente en el campo anterior)
                    </div>
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label>Comentarios / Observaciones del Evaluador</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={editForm.comentarios}
                  onChange={(e) => setEditForm({ ...editForm, comentarios: e.target.value })}
                  placeholder="Observaciones de la evaluación..."
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renovar Manejo Comentado */}
      {showRenovarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Renovar Manejo Comentado (Directo)</h2>
            <form onSubmit={handleRenovarSubmit}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Selecciona el Conductor *</label>
                <select
                  className="form-control"
                  value={renovarForm.idConductor}
                  onChange={(e) => setRenovarForm({ ...renovarForm, idConductor: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Conductor --</option>
                  {conductores.map((c) => (
                    <option key={c.id_conductores} value={c.id_conductores}>
                      {c.nombre} ({c.empresa || "Sin Empresa"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Fecha de Evaluación *</label>
                <input
                  type="date"
                  className="form-control"
                  value={renovarForm.fechaEvaluacion}
                  onChange={(e) => setRenovarForm({ ...renovarForm, fechaEvaluacion: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Calificación (0 - 100) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={renovarForm.calificacion}
                  onChange={(e) => {
                    const val = e.target.value;
                    const score = Number(val);
                    const autoStatus = score >= 50 ? "APROBADO" : "REPROBADO";
                    setRenovarForm({ ...renovarForm, calificacion: val, estadoEvaluacion: autoStatus });
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Resultado de Evaluación</label>
                <select
                  className="form-control"
                  value={renovarForm.estadoEvaluacion}
                  onChange={(e) => setRenovarForm({ ...renovarForm, estadoEvaluacion: e.target.value })}
                >
                  <option value="APROBADO">APROBADO</option>
                  <option value="REPROBADO">REPROBADO</option>
                </select>
              </div>

              {/* Vista previa del cálculo dinámico */}
              {(() => {
                const preview = getPreviewVigencia(renovarForm.calificacion, renovarForm.fechaEvaluacion);
                return (
                  <div
                    style={{
                      background: preview.aprobado ? "#eefbf3" : "#fff5f5",
                      border: `1px solid ${preview.aprobado ? "#abebd2" : "#feb2b2"}`,
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "1rem",
                      fontSize: "0.9rem"
                    }}
                  >
                    <strong>Cálculo de Vigencia Asignada:</strong>
                    <div style={{ marginTop: "4px" }}>
                      • <strong>Estatus:</strong> {preview.aprobado ? "APROBADO" : "REPROBADO"} ({preview.label})
                    </div>
                    {preview.aprobado && preview.fechaVencimiento && (
                      <div style={{ marginTop: "2px", color: "#166534" }}>
                        • <strong>Fecha de Vencimiento:</strong> {preview.fechaVencimiento} (calculada descontando los días de la evaluación)
                      </div>
                    )}
                    {!preview.aprobado && (
                      <div style={{ marginTop: "2px", color: "#991b1b" }}>
                        • Re-evaluación y curso programados para el próximo mes.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Comentarios / Observaciones del Evaluador</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={renovarForm.comentarios}
                  onChange={(e) => setRenovarForm({ ...renovarForm, comentarios: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowRenovarModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar y Renovar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Programar Curso */}
      {showProgramarModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>Programar Curso de Manejo Comentado</h2>
            <p style={{ color: "#607986", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Define la fecha del curso oral, la ventana de evaluación práctica y selecciona manualmente a los integrantes del equipo.
            </p>
            <form onSubmit={handleProgramarSubmit}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Título del Curso *</label>
                <input
                  type="text"
                  className="form-control"
                  value={cursoForm.titulo}
                  onChange={(e) => setCursoForm({ ...cursoForm, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Fecha de Curso Oral *</label>
                <input
                  type="date"
                  className="form-control"
                  value={cursoForm.fechaCursoOral}
                  onChange={(e) => setCursoForm({ ...cursoForm, fechaCursoOral: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label>Inicio Evaluación Práctica *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cursoForm.fechaEvaluacionInicio}
                    onChange={(e) => setCursoForm({ ...cursoForm, fechaEvaluacionInicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fin Evaluación Práctica *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cursoForm.fechaEvaluacionFin}
                    onChange={(e) => setCursoForm({ ...cursoForm, fechaEvaluacionFin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ margin: 0 }}>Integrantes de tu equipo a ingresar * ({cursoForm.idConductores.length} seleccionados)</label>
                  <div>
                    <button type="button" className="btn-link" onClick={selectAllDrivers}>Todos</button>
                    <button type="button" className="btn-link" onClick={deselectAllDrivers}>Ninguno</button>
                  </div>
                </div>
                <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #c2d8e3", padding: "10px", borderRadius: "8px", background: "#fdfefe" }}>
                  {conductores.map((c) => {
                    const isChecked = cursoForm.idConductores.includes(c.id_conductores);
                    return (
                      <label key={c.id_conductores} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDriverSelection(c.id_conductores)}
                        />
                        <span>{c.nombre} <small style={{ color: "#607986" }}>({c.empresa || "Sin Empresa"}) - {c.estado_vigencia}</small></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Notas / Indicaciones para el Grupo</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Lugar de reunión, material requerido, etc."
                  value={cursoForm.notas}
                  onChange={(e) => setCursoForm({ ...cursoForm, notas: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowProgramarModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Programando..." : "Programar y Notificar a Telegram"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
