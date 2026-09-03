import { useEffect, useState } from "react";
import {
  getManejoComentadoConductores,
  programarCursoManejoComentado,
  renovarManejoComentadoDirecto,
  getCursosManejoComentado
} from "../services/api.js";

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
      return "status-badge status-pending";
    case "VENCIDO":
    case "SIN_REGISTRO":
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
    case "SIN_REGISTRO":
      return "Sin registro";
    default:
      return estado;
  }
}

export default function ManejoComentadoPage({ user }) {
  const [activeTab, setActiveTab] = useState("conductores"); // 'conductores' | 'cursos'
  const [conductores, setConductores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Modales
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showProgramarModal, setShowProgramarModal] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Seguridad Vial</span>
          <h1>Manejo Comentado</h1>
          <p>Supervisión, agendamiento de cursos y control de vigencia semestral (6 meses) para conductores.</p>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"].includes(user.rol) && (
            <>
              <a
                href="/evaluacion"
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                📱 Aplicativo Móvil (/evaluacion)
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
              >
                📅 Programar Curso
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
          onClick={() => setActiveTab("conductores")}
        >
          Conductores y Vigencias
        </button>
        <button
          type="button"
          className={`ranking-tab-btn ${activeTab === "cursos" ? "active" : ""}`}
          onClick={() => setActiveTab("cursos")}
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="status-filter">
              <span>Estado</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
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
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th>Empresa</th>
                      <th>Licencia</th>
                      <th>Última Evaluación</th>
                      <th>Vencimiento (6 Meses)</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conductores.map((conductor) => (
                      <tr key={conductor.id_conductores}>
                        <td>
                          <strong>{conductor.nombre}</strong>
                          {conductor.telefono && <small style={{ display: "block", color: "#607986" }}>{conductor.telefono}</small>}
                        </td>
                        <td>{conductor.empresa || "N/A"}</td>
                        <td>
                          {conductor.licencia_numero}
                          <small style={{ display: "block", color: "#607986" }}>{conductor.tipo_licencia}</small>
                        </td>
                        <td>{formatDate(conductor.fecha_manejo_comentado)}</td>
                        <td>{formatDate(conductor.fecha_vencimiento)}</td>
                        <td>
                          <span className={getBadgeClass(conductor.estado_vigencia)}>
                            {getBadgeLabel(conductor.estado_vigencia, conductor.dias_para_vencer)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <a
                              href="/evaluacion"
                              target="_blank"
                              rel="noreferrer"
                              className="secondary-button"
                              style={{ padding: "5px 12px", fontSize: "0.82rem", textDecoration: "none" }}
                              title="Evaluar desde la app móvil"
                            >
                              📱 Evaluar Móvil
                            </a>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "5px 12px", fontSize: "0.82rem" }}
                              onClick={() => handleSelectConductorRenovar(conductor)}
                            >
                              Renovar Directo
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "cursos" && (
        <section className="table-panel">
          {cursos.length === 0 ? (
            <p className="table-status">No hay cursos de manejo comentado agendados.</p>
          ) : (
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
                  {cursos.map((c) => (
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
          )}
        </section>
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

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Calificación (0 - 100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={renovarForm.calificacion}
                  onChange={(e) => setRenovarForm({ ...renovarForm, calificacion: e.target.value })}
                  required
                />
              </div>

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
