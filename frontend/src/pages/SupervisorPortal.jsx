import { useEffect, useRef, useState } from "react";
import { asignarVehiculoSupervisor, decidirSupervisorInspeccion, getSupervisorAsignaciones, getSupervisorInspeccion, getSupervisorInspecciones, ingresarCorreoSupervisor } from "../services/api.js";
import DamageViewer from "../components/DamageViewer.jsx";

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
  const [activeTab, setActiveTab] = useState("inspecciones"); // "inspecciones" | "asignaciones"

  // Inspecciones state
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [comment, setComment] = useState("");

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

  return (
    <main className="container">
      {/* Navegación por pestañas */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "2px solid #e2e8f0", paddingBottom: "8px" }}>
        <button
          type="button"
          onClick={() => { setActiveTab("inspecciones"); setDetail(null); setMessage(""); setErrorMessage(""); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
            background: activeTab === "inspecciones" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "inspecciones" ? "#ffffff" : "#475569"
          }}
        >
          📋 Inspecciones
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("asignaciones"); setMessage(""); setErrorMessage(""); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
            background: activeTab === "asignaciones" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "asignaciones" ? "#ffffff" : "#475569"
          }}
        >
          🚗 Asignación Vehicular
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
                  <strong>{item.folio}</strong><br/>
                  {item.conductor} · {item.vehiculo} ({item.numero_economico})
                </button>
              )) : <p>No hay inspecciones pendientes.</p>}
            </section>
          ) : (
            <section className="result-card">
              <button type="button" onClick={() => setDetail(null)}>← Volver</button>
              <h2>{detail.folio}</h2>
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

