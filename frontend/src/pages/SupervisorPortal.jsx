import { useEffect, useRef, useState } from "react";
import {
  asignarVehiculoSupervisor,
  decidirSupervisorInspeccion,
  getSupervisorAsignaciones,
  getSupervisorInspeccion,
  getSupervisorInspecciones,
  ingresarCorreoSupervisor,
  listGerenciamientosViaje,
  aprobarGerenciamientoViaje
} from "../services/api.js";
import DamageViewer from "../components/DamageViewer.jsx";
import logoAQR from "../assets/logoAQR.webp";

function Signature({ onSave }) {
  const ref = useRef(null); const drawing = useRef(false); const [ink, setInk] = useState(false); const [open, setOpen] = useState(false);
  function point(event) { const canvas = ref.current; const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height)]; }
  function down(event) { const [x,y] = point(event); const c = ref.current.getContext("2d"); c.beginPath(); c.moveTo(x,y); c.lineWidth=2.5; c.lineCap="round"; drawing.current=true; setInk(true); }
  function move(event) { if (!drawing.current) return; const [x,y] = point(event); const c=ref.current.getContext("2d"); c.lineTo(x,y); c.stroke(); }
  function clear() { const canvas = ref.current; canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); setInk(false); }
  function save() { onSave(ref.current.toDataURL("image/png")); setOpen(false); }
  return <section className="information-panel"><h3>Firma del supervisor</h3><button type="button" onClick={()=>setOpen(true)}>Abrir ventana de firma</button>{open && <div className="signature-dialog" role="dialog" aria-modal="true" aria-label="Firma del supervisor"><section className="signature-dialog-card"><div className="signature-dialog-heading"><div><span>Autorización</span><h3>Firma del supervisor</h3><p>Firma dentro del recuadro y guarda para continuar.</p></div></div><div className="signature-canvas-area"><canvas ref={ref} className="signature-canvas" width="640" height="360" onPointerDown={down} onPointerMove={move} onPointerUp={()=>drawing.current=false} onPointerLeave={()=>drawing.current=false}/></div><div className="signature-dialog-actions"><button type="button" className="inspection-secondary-button" onClick={()=>setOpen(false)}>Cancelar</button><button type="button" className="inspection-secondary-button" disabled={!ink} onClick={clear}>Limpiar</button><button type="button" className="inspection-primary-button" disabled={!ink} onClick={save}>Guardar firma</button></div></section></div>}</section>;
}

export default function SupervisorPortal({ access, onAccessChanged }) {
  const [tenantEmail, setTenantEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("inspecciones"); // "inspecciones" | "gerenciamiento" | "asignaciones"

  // Inspecciones state
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [comment, setComment] = useState("");

  // Gerenciamiento state
  const [gerenciamientos, setGerenciamientos] = useState([]);
  const [gerenciamientoDetail, setGerenciamientoDetail] = useState(null);
  const [autorizadorNombre, setAutorizadorNombre] = useState(access.supervisorNombre || "Supervisor");
  const [subTabGerencia, setSubTabGerencia] = useState("PENDIENTE");

  // Asignaciones state
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [searchConductor, setSearchConductor] = useState("");
  const [savingAssignmentId, setSavingAssignmentId] = useState(null);

  async function loadInspecciones() {
    try {
      setErrorMessage("");
      setItems((await getSupervisorInspecciones()).data);
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function loadGerenciamientos() {
    try {
      setErrorMessage("");
      const res = await listGerenciamientosViaje();
      setGerenciamientos(res.data || []);
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function loadAsignaciones() {
    try {
      setErrorMessage("");
      const res = await getSupervisorAsignaciones();
      setConductores(res.data?.conductores || []);
      setVehiculos(res.data?.vehiculos || []);
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  useEffect(() => {
    if (access.confirmed) {
      if (activeTab === "inspecciones") loadInspecciones();
      else if (activeTab === "gerenciamiento") loadGerenciamientos();
      else if (activeTab === "asignaciones") loadAsignaciones();
    }
  }, [access.confirmed, activeTab]);

  async function submitTenantEmail(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMessage("");
    try {
      const result = await ingresarCorreoSupervisor(tenantEmail.trim());
      setMessage(result.message);
      await onAccessChanged();
    } catch(error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openInspeccion(id) {
    try {
      setErrorMessage("");
      setDetail((await getSupervisorInspeccion(id)).data);
      setSignature("");
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function decide(aprobada) {
    try {
      setErrorMessage("");
      const result = await decidirSupervisorInspeccion(detail.id_inspeccion, { aprobada, comentario: comment, firma: signature });
      setMessage(result.message);
      setDetail(null);
      loadInspecciones();
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function decideGerenciamiento(estadoNuevo) {
    if (!signature) {
      setErrorMessage("Por favor guarda tu firma digital antes de procesar el gerenciamiento.");
      return;
    }
    try {
      setErrorMessage("");
      const res = await aprobarGerenciamientoViaje(gerenciamientoDetail.id_gerenciamiento, {
        idUsuarioAdmin: access.idSupervisor || null,
        nombreAutorizador: autorizadorNombre,
        firmaAutorizador: signature,
        estado: estadoNuevo,
        observaciones: comment
      });
      setMessage(res.message);
      setGerenciamientoDetail(null);
      setSignature("");
      setComment("");
      loadGerenciamientos();
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function handleAssignVehicle(idConductor, idVehiculoVal) {
    setSavingAssignmentId(idConductor);
    setMessage("");
    setErrorMessage("");
    try {
      const idVehiculo = idVehiculoVal ? Number(idVehiculoVal) : null;
      const res = await asignarVehiculoSupervisor({ idConductor, idVehiculo });
      setMessage(res.message || "Asignación actualizada.");
      await loadAsignaciones();
    } catch(error) {
      setErrorMessage(error.message || "Error al asignar vehículo.");
    } finally {
      setSavingAssignmentId(null);
    }
  }

  if (!access.registered) return (
    <main className="container">
      <h1>Acceso de supervisor</h1>
      <p>Ingresa únicamente con tu correo corporativo del tenant registrado en la lista blanca.</p>
      
      <form onSubmit={submitTenantEmail} style={{ marginTop: "16px" }}>
        <label>
          Correo Corporativo Registrado
          <input required type="email" placeholder="usuario@aspromex.com" value={tenantEmail} onChange={e=>setTenantEmail(e.target.value)} disabled={loading}/>
        </label>
        <small style={{ display: "block", color: "#64748b", marginBottom: "16px" }}>
          Verificación directa contra el tenant de Azure y la lista blanca de administración.
        </small>
        <button type="submit" className="inspection-primary-button" disabled={loading}>
          {loading ? "Verificando..." : "Ingresar con mi Correo Tenant"}
        </button>
      </form>

      {errorMessage && <p className="message message-error" style={{ marginTop: "16px" }}>{errorMessage}</p>}
      {message && <p className="message message-success" style={{ marginTop: "16px" }}>{message}</p>}
    </main>
  );

  if (!access.confirmed) return <main className="container"><h1>Confirma tu correo</h1><p>Te enviamos un enlace de bienvenida. Ábrelo y vuelve a entrar desde Telegram para activar las aprobaciones.</p>{errorMessage&&<p className="message message-error">{errorMessage}</p>}{message&&<p className="message message-success">{message}</p>}</main>;

  const filteredConductores = conductores.filter((c) =>
    c.nombre.toLowerCase().includes(searchConductor.toLowerCase()) ||
    (c.empresa || "").toLowerCase().includes(searchConductor.toLowerCase())
  );

  const pendingGerenciamientos = gerenciamientos.filter((g) => g.estado === "PENDIENTE");
  const processedGerenciamientos = gerenciamientos.filter((g) => g.estado !== "PENDIENTE");

  return (
    <main className="container">
      {/* Navegación por pestañas */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", borderBottom: "2px solid #e2e8f0", paddingBottom: "8px", overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => { setActiveTab("inspecciones"); setDetail(null); setGerenciamientoDetail(null); setMessage(""); setErrorMessage(""); }}
          style={{
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "inspecciones" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "inspecciones" ? "#ffffff" : "#475569"
          }}
        >
          📋 Inspecciones {items.length > 0 ? `(${items.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("gerenciamiento"); setDetail(null); setGerenciamientoDetail(null); setMessage(""); setErrorMessage(""); }}
          style={{
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "gerenciamiento" ? "linear-gradient(135deg, #1e3a8a, #0284c7)" : "#f1f5f9",
            color: activeTab === "gerenciamiento" ? "#ffffff" : "#475569"
          }}
        >
          🗺️ Gerenciamiento {pendingGerenciamientos.length > 0 ? `(${pendingGerenciamientos.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("asignaciones"); setDetail(null); setGerenciamientoDetail(null); setMessage(""); setErrorMessage(""); }}
          style={{
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "asignaciones" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "asignaciones" ? "#ffffff" : "#475569"
          }}
        >
          🚗 Asignaciones
        </button>
      </div>

      {errorMessage && <p className="message message-error">{errorMessage}</p>}
      {message && <p className="message message-success">{message}</p>}

      {/* Pestaña: Inspecciones */}
      {activeTab === "inspecciones" && (
        <>
          <h1>Inspecciones pendientes</h1>
          {!detail ? (
            <section>
              {items.length ? items.map(item => (
                <button type="button" key={item.id_inspeccion} className="result-card" onClick={() => openInspeccion(item.id_inspeccion)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                    <strong>{item.folio}</strong>
                    {item.es_dia_siguiente && <span style={{ background: "#2563eb", color: "#ffffff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "600" }}>🌙 Día Siguiente ({item.fecha_operativa})</span>}
                  </div>
                  <div>{item.conductor} · {item.vehiculo} ({item.numero_economico})</div>
                </button>
              )) : <p>No hay inspecciones pendientes.</p>}
            </section>
          ) : (
            <section className="result-card">
              <button type="button" onClick={() => setDetail(null)}>← Volver</button>
              <h2>{detail.folio}</h2>
              {detail.es_dia_siguiente && (
                <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", padding: "8px 12px", borderRadius: "8px", margin: "10px 0", fontSize: "0.85rem" }}>
                  🌙 <strong>Inspección para el Día Siguiente:</strong> Salida de madrugada programada para la fecha <strong>{detail.fecha_operativa}</strong>.
                </div>
              )}
              <p><strong>Conductor:</strong> {detail.conductor}</p>
              <p><strong>Unidad:</strong> {detail.vehiculo} · {detail.numero_economico}</p>
              <p><strong>Combustible:</strong> {detail.combustible}</p>
              <p><strong>Observaciones:</strong> {detail.observaciones_conductor || "Sin observaciones"}</p>
              <DamageViewer damages={detail.danos} vehicle={detail.vehiculo}/>
              <h3>Checklist</h3>
              <div className="table-wrapper checklist-table-wrapper">
                <table className="admin-table checklist-table">
                  <thead>
                    <tr><th>Actividad</th><th style={{ width: "90px", textAlign: "center" }}>Estado</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(detail.checklist || {}).map(([name, state]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`checklist-badge checklist-badge-${state === "B" ? "good" : state === "R" ? "regular" : state === "M" ? "bad" : "na"}`}>
                            {state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label>Comentario<textarea value={comment} onChange={e => setComment(e.target.value)}/></label>
              {signature ? <p>Firma guardada.</p> : <Signature onSave={setSignature}/>}
              <button type="button" disabled={!signature} onClick={() => decide(false)}>Rechazar</button>
              <button type="button" disabled={!signature} onClick={() => decide(true)}>Aprobar y generar PDF</button>
            </section>
          )}
        </>
      )}

      {/* Pestaña: Gerenciamiento de Viajes */}
      {activeTab === "gerenciamiento" && (
        <>
          <h1>Gerenciamiento de Viajes</h1>
          {!gerenciamientoDetail ? (
            <section>
              {/* Sub-filtro de Gerenciamientos */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => setSubTabGerencia("PENDIENTE")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid #cbd5e1",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    background: subTabGerencia === "PENDIENTE" ? "#1e40af" : "#ffffff",
                    color: subTabGerencia === "PENDIENTE" ? "#ffffff" : "#475569"
                  }}
                >
                  ⏳ Pendientes ({pendingGerenciamientos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTabGerencia("HISTORIAL")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid #cbd5e1",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    background: subTabGerencia === "HISTORIAL" ? "#1e40af" : "#ffffff",
                    color: subTabGerencia === "HISTORIAL" ? "#ffffff" : "#475569"
                  }}
                >
                  📜 Historial Procesado ({processedGerenciamientos.length})
                </button>
              </div>

              {subTabGerencia === "PENDIENTE" ? (
                pendingGerenciamientos.length ? pendingGerenciamientos.map(g => {
                  let badgeBg = "#16a34a";
                  if (g.nivel_riesgo === "ALTO") badgeBg = "#dc2626";
                  else if (g.nivel_riesgo === "MEDIO") badgeBg = "#ca8a04";

                  return (
                    <button type="button" key={g.id_gerenciamiento} className="result-card" onClick={() => setGerenciamientoDetail(g)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                        <strong>{g.folio_documento} #{g.id_gerenciamiento}</strong>
                        <span style={{ background: badgeBg, color: "#ffffff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                          RIESGO {g.nivel_riesgo} ({g.puntaje_total} pts)
                        </span>
                      </div>
                      <div style={{ textAlign: "left", fontSize: "0.88rem" }}>
                        <div><strong>Conductor:</strong> {g.nombre_conductor || g.conductor_nombre}</div>
                        <div><strong>Ruta:</strong> {g.origen_nombre} ➔ {g.destino_nombre}</div>
                        <div><strong>Estado:</strong> <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#fef9c3", color: "#854d0e", fontWeight: "bold" }}>PENDIENTE</span></div>
                      </div>
                    </button>
                  );
                }) : (
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", margin: "12px 0" }}>
                    <span style={{ fontSize: "2rem" }}>✅</span>
                    <h3 style={{ margin: "8px 0 4px", color: "#166534" }}>No hay gerenciamientos pendientes</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Todos los gerenciamientos de viaje registrados han sido procesados. Consulta la pestaña Historial para ver los aprobados o rechazados.</p>
                  </div>
                )
              ) : (
                processedGerenciamientos.length ? processedGerenciamientos.map(g => {
                  const isAprobado = g.estado === "APROBADO";

                  return (
                    <button type="button" key={g.id_gerenciamiento} className="result-card" onClick={() => setGerenciamientoDetail(g)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                        <strong>{g.folio_documento} #{g.id_gerenciamiento}</strong>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", background: isAprobado ? "#dcfce7" : "#fee2e2", color: isAprobado ? "#166534" : "#991b1b" }}>
                          {g.estado}
                        </span>
                      </div>
                      <div style={{ textAlign: "left", fontSize: "0.88rem" }}>
                        <div><strong>Conductor:</strong> {g.nombre_conductor || g.conductor_nombre}</div>
                        <div><strong>Ruta:</strong> {g.origen_nombre} ➔ {g.destino_nombre}</div>
                        <div><strong>Evaluado por:</strong> {g.nombre_autorizador_firma || "Autorizador"}</div>
                      </div>
                    </button>
                  );
                }) : (
                  <p>No hay gerenciamientos en el historial.</p>
                )
              )}
            </section>
          ) : (
            <section className="result-card" style={{ textAlign: "left" }}>
              <button type="button" onClick={() => setGerenciamientoDetail(null)}>← Volver</button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 0" }}>
                <img src={logoAQR} alt="AQUARIO" style={{ height: "36px" }} />
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Doc: {gerenciamientoDetail.folio_documento}</h2>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", fontSize: "0.85rem", display: "grid", gap: "4px", marginBottom: "12px" }}>
                <div><strong>Conductor:</strong> {gerenciamientoDetail.nombre_conductor}</div>
                <div><strong>Fecha:</strong> {String(gerenciamientoDetail.fecha_emision).split("T")[0]}</div>
                <div><strong>Ruta:</strong> {gerenciamientoDetail.origen_nombre} ➔ {gerenciamientoDetail.destino_nombre}</div>
                <div><strong>Presión / Glucosa:</strong> {gerenciamientoDetail.presion_arterial} / {gerenciamientoDetail.glucosa}</div>
                <div><strong>Alcoholímetro:</strong> {gerenciamientoDetail.alcoholimetro ? "POSITIVO (+)" : "NEGATIVO"}</div>
              </div>

              <div style={{ background: gerenciamientoDetail.nivel_riesgo === 'ALTO' ? '#fef2f2' : gerenciamientoDetail.nivel_riesgo === 'MEDIO' ? '#fefce8' : '#f0fdf4', padding: "10px", borderRadius: "8px", marginBottom: "12px" }}>
                <strong>Puntaje Riesgo Total: {gerenciamientoDetail.puntaje_total} pts ({gerenciamientoDetail.nivel_riesgo})</strong>
                <div style={{ fontSize: "0.8rem", marginTop: "2px" }}>Autorización requerida: {gerenciamientoDetail.autorizacion_requerida}</div>
              </div>

              <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", padding: "10px", borderRadius: "8px", marginBottom: "12px", fontSize: "0.85rem", color: "#0369a1" }}>
                <strong>🚗 Inspección Vehicular Integrada con este Gerenciamiento:</strong>
                <div>Combustible: <strong>{gerenciamientoDetail.inspeccion_combustible || "3/4"}</strong></div>
                <div>Estado: <strong style={{ color: gerenciamientoDetail.inspeccion_estado === 'APROBADA' || gerenciamientoDetail.estado === 'APROBADO' ? '#166534' : '#d97706' }}>{gerenciamientoDetail.inspeccion_estado || (gerenciamientoDetail.estado === 'APROBADO' ? 'APROBADA' : 'PENDIENTE CON GERENCIAMIENTO')}</strong></div>
                {gerenciamientoDetail.inspeccion_observaciones && (
                  <div>Obs. Vehículo: {gerenciamientoDetail.inspeccion_observaciones}</div>
                )}
              </div>

              {gerenciamientoDetail.firma_conductor && (
                <div style={{ marginBottom: "12px" }}>
                  <small>Firma del Conductor:</small>
                  <img src={gerenciamientoDetail.firma_conductor} alt="Firma Conductor" style={{ maxHeight: "80px", display: "block", background: "#fff", border: "1px solid #cbd5e1", padding: "4px", borderRadius: "4px" }} />
                </div>
              )}

              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                Nombre del Autorizador:
                <input type="text" value={autorizadorNombre} onChange={e => setAutorizadorNombre(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
              </label>

              <label style={{ fontSize: "0.85rem", fontWeight: "bold", marginTop: "8px" }}>
                Observaciones / Comentario:
                <textarea rows="2" value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentarios u observaciones de control"/>
              </label>

              {signature ? <p style={{ color: "#166534", fontWeight: "bold" }}>✅ Firma guardada</p> : <Signature onSave={setSignature}/>}

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button type="button" style={{ background: "#ef4444", color: "#fff" }} disabled={!signature} onClick={() => decideGerenciamiento("RECHAZADO")}>
                  Rechazar
                </button>
                <button type="button" style={{ background: "#16a34a", color: "#fff" }} disabled={!signature} onClick={() => decideGerenciamiento("APROBADO")}>
                  Aprobar Gerenciamiento e Inspección
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* Pestaña: Asignación Vehicular */}
      {activeTab === "asignaciones" && (
        <>
          <h1>Asignación Vehicular</h1>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>
            Asigna una unidad a un conductor. La unidad aparecerá pre-seleccionada automáticamente en su MiniApp.
          </p>

          <div style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="🔍 Buscar conductor..."
              value={searchConductor}
              onChange={(e) => setSearchConductor(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <section>
            {filteredConductores.length ? filteredConductores.map((c) => {
              const assignedVehicle = vehiculos.find(v => String(v.id_vehiculos) === String(c.id_vehiculo_asignado));
              return (
                <div key={c.id_conductores} className="result-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <strong>{c.nombre}</strong> {c.empresa ? `(${c.empresa})` : ""}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: assignedVehicle ? "#15803d" : "#64748b" }}>
                    {assignedVehicle ? `🚗 Asignado: ${assignedVehicle.nombre} (${assignedVehicle.numero_economico})` : "⚪ Sin unidad asignada"}
                  </div>
                  <label style={{ margin: 0, fontWeight: "normal", fontSize: "0.85rem" }}>
                    Seleccionar unidad:
                    <select
                      value={c.id_vehiculo_asignado || ""}
                      onChange={(e) => handleAssignVehicle(c.id_conductores, e.target.value)}
                      disabled={savingAssignmentId === c.id_conductores}
                      style={{ marginTop: "4px", width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- Sin unidad asignada --</option>
                      {vehiculos.map((v) => (
                        <option key={v.id_vehiculos} value={v.id_vehiculos}>
                          {v.nombre} — {v.numero_economico} {v.placas ? `(${v.placas})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            }) : <p>No se encontraron conductores.</p>}
          </section>
        </>
      )}
    </main>
  );
}
