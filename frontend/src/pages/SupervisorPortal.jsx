import { useEffect, useRef, useState, Component } from "react";
import {
  asignarVehiculoSupervisor,
  decidirSupervisorInspeccion,
  getSupervisorAsignaciones,
  getSupervisorInspeccion,
  getSupervisorInspecciones,
  ingresarCorreoSupervisor,
  listGerenciamientosViaje,
  aprobarGerenciamientoViaje,
  getGerenciamientoViaje,
  getSupervisorConductoresPendientes,
  decidirSupervisorConductor
  ,getAutorizacionesManejoComentado
  ,decidirAutorizacionManejoComentado
} from "../services/api.js";
import {
  IconCheck,
  IconCross,
  IconAlert,
  IconCar,
  IconMap,
  IconClipboard,
  IconClock,
  IconMoon,
  IconIdCard,
  IconEdit,
  IconRefresh,
  IconWrench,
  IconScale,
  IconShield,
  IconMenu
} from "../components/Icons.jsx";
import DamageViewer from "../components/DamageViewer.jsx";
import logoAQR from "../assets/logoAQR.webp";

function SignaturePadModal({
  title = "Firma Digital de Autorización",
  subtitle = "Firma dentro del recuadro con tu dedo o ratón y confirma para continuar.",
  onSave,
  onClose
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const configureCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = "#0f172a";
      drawingRef.current = false;
      setHasInk(false);
    };
    const frame = window.requestAnimationFrame(configureCanvas);
    window.addEventListener("resize", configureCanvas);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", configureCanvas);
    };
  }, []);

  function pointFor(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    };
  }

  function beginStroke(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pt = pointFor(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    canvas.setPointerCapture?.(event.pointerId);
    setHasInk(true);
  }

  function drawStroke(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const pt = pointFor(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function endStroke(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
  }

  function handleSave() {
    if (!hasInk || !canvasRef.current) return;
    onSave(canvasRef.current.toDataURL("image/png"));
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", zIndex: 999999, display: "grid", placeItems: "center", padding: "16px" }}>
      <div style={{ background: "#ffffff", borderRadius: "16px", padding: "20px", maxWidth: "560px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", color: "#2563eb", letterSpacing: "0.05em" }}>Autorización de Operaciones</span>
            <h3 style={{ margin: "2px 0 0", fontSize: "1.2rem", color: "#0f172a" }}>{title}</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "#f1f5f9", border: 0, borderRadius: "50%", width: "32px", height: "32px", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}>×</button>
        </div>

        <div style={{ border: "2px dashed #94a3b8", borderRadius: "12px", background: "#f8fafc", overflow: "hidden", marginBottom: "16px" }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "180px", touchAction: "none", cursor: "crosshair", display: "block" }}
            onPointerDown={beginStroke}
            onPointerMove={drawStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={clear}
            style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "10px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}
          >
            Limpiar Firma
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasInk}
            style={{
              background: hasInk ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#cbd5e1",
              color: "#ffffff",
              border: 0,
              padding: "10px 22px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: hasInk ? "pointer" : "not-allowed"
            }}
          >
            Confirmar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function checkRolCanAuthorize(userRol, nivelRiesgo) {
  const rol = String(userRol || "").toUpperCase().trim();
  const rolesBajo = ['SUPERVISOR', 'QHSE', 'COORDINADOR', 'COORDINADOR_AREA', 'COORDINADOR_QHSE', 'GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN', 'INSTRUCTOR'];
  const rolesMedio = ['COORDINADOR', 'COORDINADOR_AREA', 'COORDINADOR_QHSE', 'GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN'];
  const rolesAlto = ['GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN'];

  if (nivelRiesgo === 'ALTO') return rolesAlto.includes(rol);
  if (nivelRiesgo === 'MEDIO') return rolesMedio.includes(rol);
  return rolesBajo.includes(rol);
}

function tryParseJson(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

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

function renderSupervisorChecklist(checklist = {}) {
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", margin: "14px 0" }}>
      {categories.map(({ groupName, items }) => (
        <div key={groupName} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", fontWeight: "bold", fontSize: "0.85rem", color: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{groupName}</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "normal" }}>{items.length} items</span>
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[SupervisorPortal] Error en render:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "16px", background: "#fee2e2", border: "1px solid #f87171", borderRadius: "8px", color: "#991b1b", margin: "16px 0" }}>
          <h3>⚠️ Ocurrió un problema al mostrar el gerenciamiento</h3>
          <p style={{ fontSize: "0.85rem" }}>{this.state.error?.message || "Error al procesar los datos del formulario"}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            style={{ padding: "8px 14px", background: "#b91c1c", color: "#fff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            ← Volver a la lista
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SupervisorPortal({ access, onAccessChanged }) {
  const [tenantEmail, setTenantEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("inspecciones"); // "inspecciones" | "gerenciamiento" | "asignaciones"
  const [showSidebar, setShowSidebar] = useState(false);

  // Inspecciones state
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [comment, setComment] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Gerenciamiento state
  const [gerenciamientos, setGerenciamientos] = useState([]);
  const [gerenciamientoDetail, setGerenciamientoDetail] = useState(null);
  const [autorizadorNombre, setAutorizadorNombre] = useState(access.user?.nombre || access.supervisorNombre || "Supervisor");
  const [subTabGerencia, setSubTabGerencia] = useState("PENDIENTE");

  // Asignaciones state
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [searchConductor, setSearchConductor] = useState("");
  const [savingAssignmentId, setSavingAssignmentId] = useState(null);

  // Conductores pendientes state
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverComment, setDriverComment] = useState("");
  const [driverActionLoading, setDriverActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Autorizaciones excepcionales por manejo comentado vencido/no registrado.
  const [manejoAuthorizations, setManejoAuthorizations] = useState([]);
  const [selectedManejoAuthorization, setSelectedManejoAuthorization] = useState(null);

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

  async function loadPendingDrivers() {
    try {
      setErrorMessage("");
      const res = await getSupervisorConductoresPendientes();
      setPendingDrivers(res.data || []);
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function loadManejoAuthorizations() {
    try {
      setErrorMessage("");
      const res = await getAutorizacionesManejoComentado();
      setManejoAuthorizations(res.data || []);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleDecideDriver(idConductor, aprobado) {
    const action = aprobado ? "aprobar" : "rechazar";
    if (!window.confirm(`¿Estás seguro de que deseas ${action} a este conductor?`)) return;
    setDriverActionLoading(true);
    setErrorMessage("");
    try {
      const res = await decidirSupervisorConductor(idConductor, {
        aprobado,
        comentario: driverComment
      });
      setMessage(res.message);
      setSelectedDriver(null);
      setDriverComment("");
      await loadPendingDrivers();
    } catch(error) {
      setErrorMessage(error.message);
    } finally {
      setDriverActionLoading(false);
    }
  }

  useEffect(() => {
    if (access.confirmed) {
      loadPendingDrivers();
      if (activeTab === "inspecciones") loadInspecciones();
      else if (activeTab === "gerenciamiento") loadGerenciamientos();
      else if (activeTab === "asignaciones") loadAsignaciones();
      else if (activeTab === "conductores") loadPendingDrivers();
      else if (activeTab === "manejo-comentado") loadManejoAuthorizations();
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

  const currentUserRole = String(access.user?.rol || access.rol || "SUPERVISOR").toUpperCase();
  const canAuthorizeGerenciamiento = gerenciamientoDetail
    ? checkRolCanAuthorize(currentUserRole, gerenciamientoDetail.nivel_riesgo)
    : false;

  async function openInspeccion(id) {
    try {
      setErrorMessage("");
      setDetail((await getSupervisorInspeccion(id)).data);
      setSignature("");
      setComment("");
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function openGerenciamiento(g) {
    setErrorMessage("");
    setSignature("");
    setComment("");
    setGerenciamientoDetail(g);
    try {
      const res = await getGerenciamientoViaje(g.id_gerenciamiento);
      if (res?.data) {
        setGerenciamientoDetail(res.data);
      }
    } catch {
      // Usar g como fallback
    }
  }

  async function decide(aprobada) {
    try {
      setErrorMessage("");
      const result = await decidirSupervisorInspeccion(detail.id_inspeccion, { aprobada, comentario: comment, firma: signature });
      setMessage(result.message);
      setDetail(null);
      setSignature("");
      setComment("");
      loadInspecciones();
    } catch(error) {
      setErrorMessage(error.message);
    }
  }

  async function decideGerenciamiento(estadoNuevo) {
    if (!signature) {
      setErrorMessage("Por favor captura y guarda tu firma digital antes de procesar el gerenciamiento.");
      return;
    }
    try {
      setErrorMessage("");
      const idUsuarioAdmin = access.user?.id_usuarios_admin || access.idSupervisor || null;
      const res = await aprobarGerenciamientoViaje(gerenciamientoDetail.id_gerenciamiento, {
        idUsuarioAdmin,
        nombreAutorizador: autorizadorNombre || access.user?.nombre || access.supervisorNombre || "Supervisor",
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

  async function decideManejoComentado(aprobada) {
    if (!signature) {
      setErrorMessage("Captura y guarda tu firma digital antes de resolver la autorización.");
      return;
    }
    try {
      const result = await decidirAutorizacionManejoComentado(selectedManejoAuthorization.id_autorizacion, { aprobada, comentario: comment, firma: signature });
      setMessage(result.message);
      setSelectedManejoAuthorization(null);
      setSignature("");
      setComment("");
      await loadManejoAuthorizations();
    } catch (error) {
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
      {/* Barra Superior con Botón de Menú Desplegable */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "#ffffff",
        borderRadius: "12px",
        padding: "10px 14px",
        marginBottom: "16px",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)"
      }}>
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          style={{
            background: "#0284c7",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 14px",
            fontWeight: "bold",
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.4)"
          }}
        >
          <IconMenu size={20} />
          <span>Menú</span>
          {(items.length + pendingGerenciamientos.length + pendingDrivers.length + manejoAuthorizations.length) > 0 && (
            <span style={{
              background: "#ef4444",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "2px 7px",
              fontSize: "0.75rem",
              fontWeight: "800"
            }}>
              {items.length + pendingGerenciamientos.length + pendingDrivers.length + manejoAuthorizations.length}
            </span>
          )}
        </button>

        {/* Indicador de sección activa */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", fontWeight: "700" }}>
          {activeTab === "inspecciones" && <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconClipboard size={18} /> Inspecciones {items.length > 0 ? `(${items.length})` : ""}</span>}
          {activeTab === "gerenciamiento" && <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconMap size={18} /> Gerenciamiento {pendingGerenciamientos.length > 0 ? `(${pendingGerenciamientos.length})` : ""}</span>}
          {activeTab === "conductores" && <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconIdCard size={18} /> Conductores {pendingDrivers.length > 0 ? `(${pendingDrivers.length})` : ""}</span>}
          {activeTab === "manejo-comentado" && <span style={{ color: "#fbbf24", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconAlert size={18} /> Manejo Vencido {manejoAuthorizations.length > 0 ? `(${manejoAuthorizations.length})` : ""}</span>}
          {activeTab === "asignaciones" && <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconCar size={18} /> Asignaciones</span>}
        </div>
      </div>

      {/* Sidebar Desplegable (Drawer) */}
      {showSidebar && (
        <>
          {/* Fondo oscuro traslúcido */}
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 99998
            }}
          />

          {/* Panel Lateral Flotante */}
          <aside style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "85vw",
            maxWidth: "320px",
            background: "#ffffff",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            boxShadow: "6px 0 24px rgba(0,0,0,0.25)"
          }}>
            {/* Encabezado del Menú */}
            <div style={{
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              color: "#ffffff",
              padding: "20px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconShield size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "#ffffff", fontWeight: "800" }}>Supervisión</h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
                    {access.user?.nombre || access.supervisorNombre || "Usuario"} · <span style={{ color: "#38bdf8", fontWeight: "600" }}>{currentUserRole}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", padding: "4px" }}
              >
                <IconCross size={22} color="#ffffff" />
              </button>
            </div>

            {/* Opciones de Navegación */}
            <div style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "8px 12px 12px 12px" }}>
                Módulos de Gestión
              </p>

              {/* Opción 1: Inspecciones */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("inspecciones");
                  setDetail(null);
                  setGerenciamientoDetail(null);
                  setSelectedDriver(null);
                  setMessage("");
                  setErrorMessage("");
                  setShowSidebar(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  marginBottom: "6px",
                  cursor: "pointer",
                  background: activeTab === "inspecciones" ? "#e0f2fe" : "transparent",
                  color: activeTab === "inspecciones" ? "#0369a1" : "#334155",
                  fontWeight: activeTab === "inspecciones" ? "700" : "600",
                  borderLeft: activeTab === "inspecciones" ? "4px solid #0284c7" : "4px solid transparent",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <IconClipboard size={18} color={activeTab === "inspecciones" ? "#0284c7" : "#64748b"} />
                  <span>Inspecciones vehiculares</span>
                </div>
                {items.length > 0 && (
                  <span style={{ background: "#ef4444", color: "#ffffff", borderRadius: "999px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: "bold" }}>
                    {items.length}
                  </span>
                )}
              </button>

              {/* Opción 2: Gerenciamiento */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("gerenciamiento");
                  setDetail(null);
                  setGerenciamientoDetail(null);
                  setSelectedDriver(null);
                  setMessage("");
                  setErrorMessage("");
                  setShowSidebar(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  marginBottom: "6px",
                  cursor: "pointer",
                  background: activeTab === "gerenciamiento" ? "#e0f2fe" : "transparent",
                  color: activeTab === "gerenciamiento" ? "#0369a1" : "#334155",
                  fontWeight: activeTab === "gerenciamiento" ? "700" : "600",
                  borderLeft: activeTab === "gerenciamiento" ? "4px solid #0284c7" : "4px solid transparent",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <IconMap size={18} color={activeTab === "gerenciamiento" ? "#0284c7" : "#64748b"} />
                  <span>Gerenciamiento de viajes</span>
                </div>
                {pendingGerenciamientos.length > 0 && (
                  <span style={{ background: "#f59e0b", color: "#ffffff", borderRadius: "999px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: "bold" }}>
                    {pendingGerenciamientos.length}
                  </span>
                )}
              </button>

              {/* Opción 3: Conductores */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("conductores");
                  setDetail(null);
                  setGerenciamientoDetail(null);
                  setSelectedDriver(null);
                  setMessage("");
                  setErrorMessage("");
                  setShowSidebar(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  marginBottom: "6px",
                  cursor: "pointer",
                  background: activeTab === "conductores" ? "#e0f2fe" : "transparent",
                  color: activeTab === "conductores" ? "#0369a1" : "#334155",
                  fontWeight: activeTab === "conductores" ? "700" : "600",
                  borderLeft: activeTab === "conductores" ? "4px solid #0284c7" : "4px solid transparent",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <IconIdCard size={18} color={activeTab === "conductores" ? "#0284c7" : "#64748b"} />
                  <span>Aprobación de conductores</span>
                </div>
                {pendingDrivers.length > 0 && (
                  <span style={{ background: "#3b82f6", color: "#ffffff", borderRadius: "999px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: "bold" }}>
                    {pendingDrivers.length}
                  </span>
                )}
              </button>

              {/* Opción 4: Manejo Vencido (Sólo Gerentes / Administradores) */}
              {['GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN'].includes(currentUserRole) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("manejo-comentado");
                    setDetail(null);
                    setGerenciamientoDetail(null);
                    setSelectedDriver(null);
                    setSelectedManejoAuthorization(null);
                    setMessage("");
                    setErrorMessage("");
                    setShowSidebar(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "none",
                    marginBottom: "6px",
                    cursor: "pointer",
                    background: activeTab === "manejo-comentado" ? "#fef3c7" : "transparent",
                    color: activeTab === "manejo-comentado" ? "#b45309" : "#334155",
                    fontWeight: activeTab === "manejo-comentado" ? "700" : "600",
                    borderLeft: activeTab === "manejo-comentado" ? "4px solid #d97706" : "4px solid transparent",
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <IconAlert size={18} color={activeTab === "manejo-comentado" ? "#d97706" : "#64748b"} />
                    <span>Manejo comentado vencido</span>
                  </div>
                  {manejoAuthorizations.length > 0 && (
                    <span style={{ background: "#d97706", color: "#ffffff", borderRadius: "999px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {manejoAuthorizations.length}
                    </span>
                  )}
                </button>
              )}

              {/* Opción 5: Asignaciones */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("asignaciones");
                  setDetail(null);
                  setGerenciamientoDetail(null);
                  setSelectedDriver(null);
                  setMessage("");
                  setErrorMessage("");
                  setShowSidebar(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  marginBottom: "6px",
                  cursor: "pointer",
                  background: activeTab === "asignaciones" ? "#e0f2fe" : "transparent",
                  color: activeTab === "asignaciones" ? "#0369a1" : "#334155",
                  fontWeight: activeTab === "asignaciones" ? "700" : "600",
                  borderLeft: activeTab === "asignaciones" ? "4px solid #0284c7" : "4px solid transparent",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <IconCar size={18} color={activeTab === "asignaciones" ? "#0284c7" : "#64748b"} />
                  <span>Asignación de vehículos</span>
                </div>
              </button>
            </div>

            {/* Pie de página del Menú */}
            <div style={{ padding: "14px 16px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", textAlign: "center" }}>
              <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                AQUARIO · Control de Viajes
              </small>
            </div>
          </aside>
        </>
      )}

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
                    {item.es_dia_siguiente && (
                      <span style={{ background: "#2563eb", color: "#ffffff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <IconMoon size={12} /> Día Siguiente ({item.fecha_operativa})
                      </span>
                    )}
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
                <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", padding: "8px 12px", borderRadius: "8px", margin: "10px 0", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <IconMoon size={16} /> <span><strong>Inspección para el Día Siguiente:</strong> Salida de madrugada programada para la fecha <strong>{detail.fecha_operativa}</strong>.</span>
                </div>
              )}
              <p><strong>Conductor:</strong> {detail.conductor}</p>
              <p><strong>Unidad:</strong> {detail.vehiculo} · {detail.numero_economico}</p>
              <p><strong>Combustible:</strong> {detail.combustible}</p>
              <p><strong>Observaciones:</strong> {detail.observaciones_conductor || "Sin observaciones"}</p>
              <DamageViewer damages={detail.danos} vehicle={detail.vehiculo}/>
              <h3 style={{ marginTop: "16px" }}>Checklist de Verificación por Categoría</h3>
              {renderSupervisorChecklist(detail.checklist)}
              <label>Comentario<textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentarios de aprobación o rechazo"/></label>
              
              {signature ? (
                <div style={{ margin: "12px 0", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ color: "#166534", fontWeight: "bold", fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <IconCheck size={16} color="#166534" /> Firma guardada
                    </span>
                    <button type="button" onClick={() => setShowSignatureModal(true)} style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <IconRefresh size={12} /> Modificar Firma
                    </button>
                  </div>
                  <img src={signature} alt="Firma Autorizador" style={{ maxHeight: "80px", maxWidth: "100%", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px", display: "block" }} />
                </div>
              ) : (
                <div style={{ margin: "12px 0" }}>
                  <button
                    type="button"
                    onClick={() => setShowSignatureModal(true)}
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#0284c7", color: "#ffffff", border: 0, fontWeight: "bold", fontSize: "0.92rem", cursor: "pointer", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                  >
                    <IconEdit size={16} /> Capturar Firma Digital
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button type="button" style={{ background: "#ef4444", color: "#fff" }} disabled={!signature} onClick={() => decide(false)}>Rechazar</button>
                <button type="button" style={{ background: "#16a34a", color: "#fff" }} disabled={!signature} onClick={() => decide(true)}>Aprobar y generar PDF</button>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "manejo-comentado" && (
        <>
          <h1>Autorizaciones de manejo comentado</h1>
          <p style={{ color: "#64748b" }}>Solicitudes de inicio de viaje con manejo comentado vencido o no registrado. Sólo Gerente o Administrador puede autorizarlas.</p>
          {!selectedManejoAuthorization ? (
            <section>
              {manejoAuthorizations.length ? manejoAuthorizations.map((item) => (
                <button type="button" key={item.id_autorizacion} className="result-card" onClick={() => { setSelectedManejoAuthorization(item); setSignature(""); setComment(""); }}>
                  <strong>{item.folio}</strong>
                  <div>{item.conductor} · {item.vehiculo} ({item.numero_economico})</div>
                  <small>Manejo comentado: {item.fecha_manejo_comentado ? new Date(item.fecha_manejo_comentado).toLocaleDateString("es-MX") : "No registrado"}</small>
                </button>
              )) : <p>No hay solicitudes pendientes.</p>}
            </section>
          ) : (
            <section className="result-card">
              <button type="button" onClick={() => setSelectedManejoAuthorization(null)}>← Volver</button>
              <h2>{selectedManejoAuthorization.folio}</h2>
              <p><strong>Conductor:</strong> {selectedManejoAuthorization.conductor}</p>
              <p><strong>Unidad:</strong> {selectedManejoAuthorization.vehiculo} ({selectedManejoAuthorization.numero_economico})</p>
              <p style={{ color: "#b45309" }}><strong>Motivo:</strong> {selectedManejoAuthorization.motivo_solicitud}</p>
              <label>Comentario<textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Observaciones de la decisión" /></label>
              <button type="button" onClick={() => setShowSignatureModal(true)} style={{ width: "100%", margin: "12px 0", padding: "12px", borderRadius: "8px", background: signature ? "#16a34a" : "#b45309", color: "#fff", border: 0, fontWeight: "bold" }}>
                {signature ? "✓ Firma guardada — modificar" : "Capturar firma digital"}
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" style={{ background: "#ef4444", color: "#fff" }} disabled={!signature} onClick={() => decideManejoComentado(false)}>Rechazar</button>
                <button type="button" style={{ background: "#16a34a", color: "#fff" }} disabled={!signature} onClick={() => decideManejoComentado(true)}>Autorizar inicio</button>
              </div>
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
                    color: subTabGerencia === "PENDIENTE" ? "#ffffff" : "#475569",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <IconClock size={14} /> Pendientes ({pendingGerenciamientos.length})
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
                    color: subTabGerencia === "HISTORIAL" ? "#ffffff" : "#475569",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <IconClipboard size={14} /> Historial Procesado ({processedGerenciamientos.length})
                </button>
              </div>

              {subTabGerencia === "PENDIENTE" ? (
                pendingGerenciamientos.length ? pendingGerenciamientos.map(g => {
                  let badgeBg = "#16a34a";
                  if (g.nivel_riesgo === "ALTO") badgeBg = "#dc2626";
                  else if (g.nivel_riesgo === "MEDIO") badgeBg = "#ca8a04";

                  return (
                    <button type="button" key={g.id_gerenciamiento} className="result-card" onClick={() => openGerenciamiento(g)}>
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
                    <IconCheck size={36} color="#16a34a" />
                    <h3 style={{ margin: "8px 0 4px", color: "#166534" }}>No hay gerenciamientos pendientes</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Todos los gerenciamientos de viaje registrados han sido procesados. Consulta la pestaña Historial para ver los aprobados o rechazados.</p>
                  </div>
                )
              ) : (
                processedGerenciamientos.length ? processedGerenciamientos.map(g => {
                  const isAprobado = g.estado === "APROBADO";

                  return (
                    <button type="button" key={g.id_gerenciamiento} className="result-card" onClick={() => openGerenciamiento(g)}>
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
            <ErrorBoundary onReset={() => { setGerenciamientoDetail(null); setSignature(""); setComment(""); }}>
              {(() => {
                const rawAcomp = tryParseJson(gerenciamientoDetail.acompanantes, []);
                const acompanantesList = Array.isArray(rawAcomp) ? rawAcomp : [];

                const rawSitios = tryParseJson(gerenciamientoDetail.sitios_reporte, []);
                const sitiosList = Array.isArray(rawSitios) ? rawSitios : [];

                const checklistRaw = tryParseJson(gerenciamientoDetail.inspeccion_checklist, null);
                const safeChecklist = (checklistRaw && typeof checklistRaw === "object" && !Array.isArray(checklistRaw))
                  ? checklistRaw
                  : null;

                const danosRaw = tryParseJson(gerenciamientoDetail.inspeccion_danos, null);
                const safeDanos = (danosRaw && typeof danosRaw === "object" && !Array.isArray(danosRaw))
                  ? danosRaw
                  : null;

                return (
                  <section className="result-card" style={{ textAlign: "left" }}>
                    <button type="button" onClick={() => { setGerenciamientoDetail(null); setSignature(""); setComment(""); }}>← Volver</button>
                    
                    {/* Encabezado Institucional SII-MX-23-LOG-003 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", margin: "14px 0 10px 0", borderBottom: "2px solid #0284c7", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src={logoAQR} alt="AQUARIO" style={{ height: "38px" }} />
                        <div>
                          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>GERENCIAMIENTO DE VIAJE</h2>
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Código: <strong>{gerenciamientoDetail.folio_documento || "SII-MX-23-LOG-003"}</strong> (Rev. {gerenciamientoDetail.version_documento || "3.0"})</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          padding: "4px 12px",
                          borderRadius: "14px",
                          fontSize: "0.82rem",
                          fontWeight: "bold",
                          background: gerenciamientoDetail.estado === "APROBADO" ? "#dcfce7" : gerenciamientoDetail.estado === "RECHAZADO" ? "#fee2e2" : "#fef9c3",
                          color: gerenciamientoDetail.estado === "APROBADO" ? "#166534" : gerenciamientoDetail.estado === "RECHAZADO" ? "#991b1b" : "#854d0e",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          {gerenciamientoDetail.estado === "APROBADO" ? <><IconCheck size={14} /> APROBADO</> : gerenciamientoDetail.estado === "RECHAZADO" ? <><IconCross size={14} /> RECHAZADO</> : <><IconClock size={14} /> PENDIENTE DE AUTORIZACIÓN</>}
                        </span>
                      </div>
                    </div>

                    {/* 1. Control del Documento */}
                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.83rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "6px", marginBottom: "12px" }}>
                      <div><strong>Área:</strong> {gerenciamientoDetail.area_responsable || "Logística"}</div>
                      <div><strong>Depto:</strong> {gerenciamientoDetail.departamento || "Operaciones"}</div>
                      <div><strong>Fecha:</strong> {gerenciamientoDetail.fecha_emision ? String(gerenciamientoDetail.fecha_emision).split("T")[0] : "N/A"}</div>
                      <div><strong>Hora salida:</strong> {gerenciamientoDetail.hora_salida || "N/A"}</div>
                    </div>

                    {/* 2. Conductor y Acompañantes */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconUser size={16} /> Conductor y Pasajeros
                    </h3>
                    <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", display: "grid", gap: "5px", marginBottom: "12px" }}>
                      <div><strong>Nombre Conductor:</strong> {gerenciamientoDetail.nombre_conductor}</div>
                      <div><strong>Licencia:</strong> No. {gerenciamientoDetail.licencia_numero || "N/A"} · Tipo: {gerenciamientoDetail.licencia_tipo || "Chofer"} · Vigencia: {gerenciamientoDetail.licencia_vencimiento ? String(gerenciamientoDetail.licencia_vencimiento).split("T")[0] : "Vigente"}</div>
                      <div><strong>Teléfono de contacto:</strong> {gerenciamientoDetail.telefono_conductor || "No registrado"}</div>
                      <div><strong>Tiempo estimado de viaje:</strong> {gerenciamientoDetail.tiempo_viaje_horas || 1} hora(s)</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><strong>Ruta declarada:</strong> <IconMapPin size={14} color="#0284c7" /> <strong>{gerenciamientoDetail.origen_nombre || gerenciamientoDetail.origen_texto}</strong> &rarr; <strong>{gerenciamientoDetail.destino_nombre || gerenciamientoDetail.destino_texto}</strong></div>
                      {acompanantesList.length > 0 ? (
                        <div>
                          <strong>Acompañantes registrados:</strong>
                          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                            {acompanantesList.map((ac, idx) => (
                              <li key={idx}>{typeof ac === 'object' && ac !== null ? (ac.nombre || JSON.stringify(ac)) : String(ac)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div><strong>Acompañantes:</strong> <em>Sin acompañantes (viaja solo)</em></div>
                      )}
                      {sitiosList.length > 0 && (
                        <div style={{ marginTop: "4px" }}>
                          <strong>Sitios de reporte en ruta:</strong>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                            {sitiosList.map((s, idx) => {
                              const puntoName = typeof s === 'object' && s !== null ? (s.punto || s.nombre || JSON.stringify(s)) : String(s);
                              const hora = typeof s === 'object' && s !== null ? s.horaReportada : null;
                              return (
                                <span key={idx} style={{ padding: "2px 8px", borderRadius: "6px", background: hora ? "#dcfce7" : "#f1f5f9", fontSize: "0.78rem", border: "1px solid #cbd5e1", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <IconMapPin size={12} color="#0284c7" /> {puntoName} {hora ? `(Reportado: ${hora})` : "(Pendiente)"}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Datos del Vehículo */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconCar size={16} /> Unidad y Vehículo
                    </h3>
                    <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "6px", marginBottom: "12px" }}>
                      <div><strong>No. Económico:</strong> {gerenciamientoDetail.numero_unidad || "S/N"}</div>
                      <div><strong>Placas:</strong> {gerenciamientoDetail.placa || "N/A"}</div>
                      <div><strong>Modelo / Color:</strong> {gerenciamientoDetail.modelo || "N/A"} ({gerenciamientoDetail.color || "N/A"})</div>
                      <div><strong>Tipo vehículo:</strong> {gerenciamientoDetail.tipo_vehiculo || "Vehículo Liviano"}</div>
                      <div><strong>Km inicial:</strong> {Number(gerenciamientoDetail.kilometraje || 0).toLocaleString("es-MX")} km</div>
                      <div><strong>Propiedad:</strong> {gerenciamientoDetail.vehiculo_empresa !== false ? "Vehículo Empresa" : (gerenciamientoDetail.nombre_contratista ? `Contratista: ${gerenciamientoDetail.nombre_contratista}` : "Contratista / Tercero")}</div>
                    </div>

                    {/* 4. Valoración Médica Preliminar */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconClipboard size={16} /> Aptitud y Valoración Médica
                    </h3>
                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "6px", marginBottom: "12px" }}>
                      <div><strong>Presión arterial:</strong> {gerenciamientoDetail.presion_arterial || "120/80"}</div>
                      <div><strong>Glucosa:</strong> {gerenciamientoDetail.glucosa ? `${gerenciamientoDetail.glucosa} mg/dL` : "N/R"}</div>
                      <div><strong>Frec. Cardíaca:</strong> {gerenciamientoDetail.frecuencia_cardiaca ? `${gerenciamientoDetail.frecuencia_cardiaca} bpm` : "Normal"}</div>
                      <div><strong>Frec. Respiratoria:</strong> {gerenciamientoDetail.frecuencia_respiratoria ? `${gerenciamientoDetail.frecuencia_respiratoria} rpm` : "Normal"}</div>
                      <div><strong>Examen visual:</strong> {gerenciamientoDetail.examen_visual || "Normal"}</div>
                      <div>
                        <strong>Alcoholímetro:</strong>{" "}
                        {gerenciamientoDetail.alcoholimetro ? (
                          <span style={{ padding: "2px 8px", borderRadius: "10px", background: "#fee2e2", color: "#991b1b", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }}><IconAlert size={12} color="#991b1b" /> POSITIVO (ALTO RIESGO)</span>
                        ) : (
                          <span style={{ padding: "2px 8px", borderRadius: "10px", background: "#dcfce7", color: "#166534", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }}><IconCheck size={12} color="#166534" /> 0.00 Negativo</span>
                        )}
                      </div>
                    </div>

                    {/* 5. Preguntas de Verificación Operativa */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconClipboard size={16} /> Verificación de Procedimientos y Reglas
                    </h3>
                    <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.82rem", display: "grid", gap: "6px", marginBottom: "12px" }}>
                      <div>1. ¿Conocimiento de riesgos locales de la ruta? <strong>{gerenciamientoDetail.conocimiento_riesgos_locales !== false ? "SÍ" : "NO"}</strong></div>
                      <div>2. ¿Prohibido subir personal ajeno a la empresa? <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{gerenciamientoDetail.prohibido_personal_ajeno !== false ? <><IconCheck color="#166534" size={14} /> SÍ</> : <><IconCross color="#dc2626" size={14} /> NO</>}</strong></div>
                      <div>3. ¿Inspección previa del vehículo realizada? <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{gerenciamientoDetail.inspeccion_vehiculo_realizada !== false ? <><IconCheck color="#166534" size={14} /> SÍ</> : <><IconCross color="#dc2626" size={14} /> NO</>}</strong></div>
                      <div>4. ¿Reunión previa de caravana realizada? <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{gerenciamientoDetail.reunion_pre_caravana_realizada ? <><IconCheck color="#166534" size={14} /> SÍ</> : "NO APLICA / NO"}</strong></div>
                    </div>

                    {/* 6. Inspección Vehicular Integrada */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconWrench size={16} /> Inspección Vehicular Integrada
                    </h3>
                    <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "0.85rem", color: "#0369a1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                        <div>Combustible: <strong>{gerenciamientoDetail.inspeccion_combustible || "3/4"}</strong></div>
                        <div>Estado Inspección: <strong>{gerenciamientoDetail.inspeccion_estado || (gerenciamientoDetail.estado === 'APROBADO' ? 'APROBADA' : 'PENDIENTE')}</strong></div>
                      </div>
                      {gerenciamientoDetail.inspeccion_observaciones && (
                        <div style={{ marginBottom: "8px" }}><strong>Obs. del conductor:</strong> {gerenciamientoDetail.inspeccion_observaciones}</div>
                      )}

                      {safeChecklist && Object.keys(safeChecklist).length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <strong style={{ display: "block", marginBottom: "6px" }}>Puntos de Inspección Checklist:</strong>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "4px" }}>
                            {Object.entries(safeChecklist).map(([nombreItem, estadoItem]) => (
                              <div key={nombreItem} style={{ background: "#ffffff", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                                <span>{nombreItem}</span>
                                <span className={`checklist-badge checklist-badge-${estadoItem === "B" ? "good" : estadoItem === "R" ? "regular" : estadoItem === "M" ? "bad" : "na"}`}>
                                  {estadoItem}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {safeDanos && Object.keys(safeDanos).length > 0 && (
                        <div style={{ marginTop: "10px" }}>
                          <DamageViewer damages={safeDanos} vehicle={gerenciamientoDetail.tipo_vehiculo} />
                        </div>
                      )}
                    </div>

                    {/* 7. Matriz de Riesgo y Tabuladores A a G */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconScale size={16} /> Evaluación de Riesgo y Factores (Tabuladores A - G)
                    </h3>
                    <div style={{
                      background: gerenciamientoDetail.nivel_riesgo === 'ALTO' ? '#fef2f2' : gerenciamientoDetail.nivel_riesgo === 'MEDIO' ? '#fefce8' : '#f0fdf4',
                      border: `1.5px solid ${gerenciamientoDetail.nivel_riesgo === 'ALTO' ? '#f87171' : gerenciamientoDetail.nivel_riesgo === 'MEDIO' ? '#facc15' : '#86efac'}`,
                      padding: "12px",
                      borderRadius: "10px",
                      marginBottom: "12px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: "bold", color: gerenciamientoDetail.nivel_riesgo === 'ALTO' ? '#991b1b' : gerenciamientoDetail.nivel_riesgo === 'MEDIO' ? '#854d0e' : '#166534' }}>
                          Puntaje Total: {gerenciamientoDetail.puntaje_total} pts · NIVEL {gerenciamientoDetail.nivel_riesgo}
                        </div>
                        <div style={{ fontSize: "0.82rem", background: "#ffffff", padding: "4px 10px", borderRadius: "12px", border: "1px solid #cbd5e1", fontWeight: "bold" }}>
                          Autorización: {gerenciamientoDetail.autorizacion_requerida || "SUPERVISIÓN / QHSE"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "6px", fontSize: "0.8rem" }}>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>A. Distancia: <strong>{gerenciamientoDetail.pts_distancia} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>B. Clima: <strong>{gerenciamientoDetail.pts_clima} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>C. Vehículos: <strong>{gerenciamientoDetail.pts_vehiculos_personas} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>D. Condiciones vía: <strong>{gerenciamientoDetail.pts_condiciones_via} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>E. Comunicación: <strong>{gerenciamientoDetail.pts_comunicaciones} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>F. Horas previas: <strong>{gerenciamientoDetail.pts_horas_trabajadas} pts</strong></div>
                        <div style={{ background: "#ffffff", padding: "6px 8px", borderRadius: "6px" }}>G. Horario traslado: <strong>{gerenciamientoDetail.pts_hora_traslado} pts</strong></div>
                      </div>

                      {gerenciamientoDetail.es_bloqueante_horas && (
                        <div style={{ marginTop: "8px", background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IconAlert size={16} color="#dc2626" /> Alerta Crítica: Conductor con jornada excesiva previa al viaje. Requiere descanso obligatorio.
                        </div>
                      )}
                      {gerenciamientoDetail.requiere_aprobacion_nocturna && (
                        <div style={{ marginTop: "6px", background: "#eff6ff", color: "#1e40af", padding: "6px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IconMoon size={16} color="#1e40af" /> Traslado programado en horario nocturno. Requiere autorización estricta.
                        </div>
                      )}
                    </div>

                    {/* 8. Firma del Conductor */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconEdit size={16} /> Firma del Conductor
                    </h3>
                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      {gerenciamientoDetail.firma_conductor ? (
                        <div>
                          <img
                            src={gerenciamientoDetail.firma_conductor}
                            alt="Firma Conductor"
                            style={{ maxHeight: "80px", maxWidth: "220px", display: "block", background: "#fff", border: "1px solid #cbd5e1", padding: "4px", borderRadius: "6px" }}
                          />
                          <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                            Conductor: {gerenciamientoDetail.nombre_conductor_firma || gerenciamientoDetail.nombre_conductor}
                          </small>
                        </div>
                      ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>Firma no registrada por el conductor.</p>
                      )}
                    </div>

                    {/* 9. Dictamen de Aprobación según Rol */}
                    <h3 style={{ fontSize: "0.95rem", color: "#1e3a8a", margin: "14px 0 6px 0", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconShield size={16} /> Dictamen de Autorización (Rol: {currentUserRole})
                    </h3>

                    {gerenciamientoDetail.estado !== "PENDIENTE" ? (
                      /* Detalle de Gerenciamiento ya procesado */
                      <div style={{ background: gerenciamientoDetail.estado === "APROBADO" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${gerenciamientoDetail.estado === "APROBADO" ? "#86efac" : "#f87171"}`, padding: "14px", borderRadius: "10px", marginBottom: "12px" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: gerenciamientoDetail.estado === "APROBADO" ? "#166534" : "#991b1b", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {gerenciamientoDetail.estado === "APROBADO" ? <><IconCheck color="#166534" size={18} /> VIAJE Y GERENCIAMIENTO AUTORIZADO</> : <><IconCross color="#991b1b" size={18} /> VIAJE RECHAZADO</>}
                        </div>
                        <div style={{ fontSize: "0.85rem" }}>
                          <div><strong>Autorizado por:</strong> {gerenciamientoDetail.nombre_autorizador_firma || "Supervisor"}</div>
                          {gerenciamientoDetail.fecha_firma_autorizador && (
                            <div><strong>Fecha dictamen:</strong> {new Date(gerenciamientoDetail.fecha_firma_autorizador).toLocaleString("es-MX")}</div>
                          )}
                          {gerenciamientoDetail.observaciones && (
                            <div style={{ marginTop: "4px" }}><strong>Comentarios:</strong> {gerenciamientoDetail.observaciones}</div>
                          )}
                        </div>
                        {gerenciamientoDetail.firma_autorizador && (
                          <div style={{ marginTop: "10px" }}>
                            <small style={{ color: "#475569", display: "block", marginBottom: "4px" }}>Firma del Autorizador:</small>
                            <img src={gerenciamientoDetail.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "75px", maxWidth: "220px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px" }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Formulario de Decisión para Gerenciamiento PENDIENTE */
                      <div>
                        {/* Validación de Rol */}
                        {!canAuthorizeGerenciamiento && (
                          <div style={{ background: "#fff7ed", border: "1.5px solid #fdba74", color: "#c2410c", padding: "12px", borderRadius: "10px", marginBottom: "14px", fontSize: "0.85rem" }}>
                            <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}><IconAlert size={16} color="#c2410c" /> Facultades de Autorización Insuficientes:</strong>
                            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
                              Tu rol actual es <strong>{currentUserRole}</strong>. Este viaje clasificado como <strong>RIESGO {gerenciamientoDetail.nivel_riesgo}</strong> requiere la aprobación de: <strong>{gerenciamientoDetail.autorizacion_requerida || "COORDINACIÓN / GERENCIA"}</strong>.
                            </p>
                          </div>
                        )}

                        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "8px" }}>
                          Nombre del Autorizador:
                          <input
                            type="text"
                            value={autorizadorNombre}
                            onChange={e => setAutorizadorNombre(e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                          />
                        </label>

                        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "12px" }}>
                          Observaciones / Condiciones de Aprobación:
                          <textarea
                            rows="2"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Indica condiciones de ruta, velocidad máxima sugerida, o motivo en caso de rechazo..."
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                          />
                        </label>

                        {/* Captura de Firma Digital */}
                        {signature ? (
                          <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <span style={{ color: "#166534", fontWeight: "bold", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px" }}><IconCheck size={16} color="#166534" /> Tu firma digital está lista</span>
                              <button
                                type="button"
                                onClick={() => setShowSignatureModal(true)}
                                style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <IconRefresh size={14} /> Modificar Firma
                              </button>
                            </div>
                            <img
                              src={signature}
                              alt="Firma Supervisor"
                              style={{ maxHeight: "80px", maxWidth: "100%", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px", display: "block" }}
                            />
                          </div>
                        ) : (
                          <div style={{ marginBottom: "14px" }}>
                            <button
                              type="button"
                              onClick={() => setShowSignatureModal(true)}
                              style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "8px",
                                background: "linear-gradient(135deg, #1e40af, #0284c7)",
                                color: "#ffffff",
                                border: 0,
                                fontWeight: "bold",
                                fontSize: "0.92rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px"
                              }}
                            >
                              <IconEdit size={18} color="#ffffff" /> Abrir Captura de Firma Digital
                            </button>
                          </div>
                        )}

                        {/* Acciones de Decisión */}
                        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                          <button
                            type="button"
                            style={{ flex: 1, background: "#ef4444", color: "#fff", padding: "10px", borderRadius: "8px", border: 0, fontWeight: "bold", cursor: signature ? "pointer" : "not-allowed", opacity: signature ? 1 : 0.6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            disabled={!signature}
                            onClick={() => decideGerenciamiento("RECHAZADO")}
                          >
                            <IconCross size={16} color="#fff" /> Rechazar Gerenciamiento
                          </button>
                          <button
                            type="button"
                            style={{
                              flex: 2,
                              background: (canAuthorizeGerenciamiento && signature) ? "#16a34a" : "#94a3b8",
                              color: "#fff",
                              padding: "10px",
                              borderRadius: "8px",
                              border: 0,
                              fontWeight: "bold",
                              cursor: (canAuthorizeGerenciamiento && signature) ? "pointer" : "not-allowed",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px"
                            }}
                            disabled={!canAuthorizeGerenciamiento || !signature}
                            onClick={() => decideGerenciamiento("APROBADO")}
                          >
                            <IconCheck size={16} color="#fff" /> Aprobar Gerenciamiento e Inspección
                          </button>
                        </div>
                        {!canAuthorizeGerenciamiento && (
                          <small style={{ display: "block", color: "#b91c1c", marginTop: "6px", fontSize: "0.78rem" }}>
                            * El botón de aprobación está restringido para tu nivel de rol ({currentUserRole}).
                          </small>
                        )}
                      </div>
                    )}
                  </section>
                );
              })()}
            </ErrorBoundary>
          )}
        </>
      )}

      {/* Pestaña: Conductores Pendientes */}
      {activeTab === "conductores" && (
        <>
          <h1>Aprobación de Conductores</h1>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>
            Revisa los nuevos registros de conductores desde la MiniApp, valida sus fotos de licencia y autoriza su acceso al sistema.
          </p>

          {!selectedDriver ? (
            <section>
              {pendingDrivers.length ? pendingDrivers.map((driver) => (
                <button
                  type="button"
                  key={driver.id_conductores}
                  className="result-card"
                  onClick={() => { setSelectedDriver(driver); setDriverComment(""); setMessage(""); setErrorMessage(""); }}
                  style={{ textAlign: "left", width: "100%", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0" }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "1rem", color: "#0f172a", marginBottom: "4px" }}>
                      {driver.nombre}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Tel: {driver.telefono || "—"} · Empresa: {driver.empresa || "—"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "2px" }}>
                      Registrado: {driver.creado_en ? new Date(driver.creado_en).toLocaleString("es-MX") : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#fef3c7", color: "#92400e", fontWeight: "bold", fontSize: "0.75rem", border: "1px solid #fde68a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <IconClock size={12} /> Pendiente
                    </span>
                  </div>
                </button>
              )) : (
                <div style={{ padding: "30px 20px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <IconCheck size={32} color="#16a34a" />
                  <h3 style={{ margin: "8px 0 4px", color: "#166534" }}>No hay conductores pendientes</h3>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Todos los aspirantes registrados han sido validados.</p>
                </div>
              )}
            </section>
          ) : (
            <section className="result-card" style={{ padding: "20px" }}>
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                style={{ background: "#f1f5f9", border: 0, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", marginBottom: "14px", fontWeight: "600", fontSize: "0.85rem" }}
              >
                ← Volver a la lista
              </button>

              <h2 style={{ margin: "0 0 12px", color: "#0f172a" }}>{selectedDriver.nombre}</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.88rem" }}>
                <div><strong>Teléfono:</strong> {selectedDriver.telefono || "—"}</div>
                <div><strong>Email / Identificador:</strong> {selectedDriver.email || "—"}</div>
                <div><strong>Empresa:</strong> {selectedDriver.empresa || "—"}</div>
                <div><strong>Tipo conductor:</strong> {selectedDriver.tipo_conductor || "—"}</div>
                <div><strong>Telegram ID:</strong> {selectedDriver.telegram_chat_id || "—"}</div>
                <div><strong>Registrado:</strong> {selectedDriver.creado_en ? new Date(selectedDriver.creado_en).toLocaleString("es-MX") : "—"}</div>
              </div>

              <h3 style={{ margin: "16px 0 10px", fontSize: "1rem", color: "#1e293b" }}>Documento de Licencia de Conducir</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#ffffff", textAlign: "center" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.82rem", color: "#475569", marginBottom: "8px" }}>Frente de la Licencia</div>
                  {selectedDriver.licencia_url ? (
                    <div>
                      <img
                        src={selectedDriver.licencia_url}
                        alt="Frente de Licencia"
                        style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "6px", cursor: "pointer", objectFit: "contain", border: "1px solid #e2e8f0" }}
                        onClick={() => setPreviewImage(selectedDriver.licencia_url)}
                      />
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setPreviewImage(selectedDriver.licencia_url)}
                          style={{ background: "#e0f2fe", color: "#0369a1", border: 0, padding: "4px 10px", borderRadius: "4px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600" }}
                        >
                          Ampliar imagen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "20px 0" }}>No se subió foto frontal.</p>
                  )}
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#ffffff", textAlign: "center" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.82rem", color: "#475569", marginBottom: "8px" }}>Reverso de la Licencia</div>
                  {selectedDriver.licencia_reverso_url ? (
                    <div>
                      <img
                        src={selectedDriver.licencia_reverso_url}
                        alt="Reverso de Licencia"
                        style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "6px", cursor: "pointer", objectFit: "contain", border: "1px solid #e2e8f0" }}
                        onClick={() => setPreviewImage(selectedDriver.licencia_reverso_url)}
                      />
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setPreviewImage(selectedDriver.licencia_reverso_url)}
                          style={{ background: "#e0f2fe", color: "#0369a1", border: 0, padding: "4px 10px", borderRadius: "4px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600" }}
                        >
                          Ampliar imagen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "20px 0" }}>No se subió foto del reverso.</p>
                  )}
                </div>
              </div>

              <label style={{ display: "block", marginBottom: "16px" }}>
                <span style={{ fontWeight: "600", fontSize: "0.88rem", display: "block", marginBottom: "4px" }}>
                  Observaciones / Motivo (opcional):
                </span>
                <textarea
                  value={driverComment}
                  onChange={(e) => setDriverComment(e.target.value)}
                  placeholder="Escribe comentarios u observaciones para el conductor..."
                  rows="3"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  disabled={driverActionLoading}
                />
              </label>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{ background: "#ef4444", color: "#ffffff", border: 0, padding: "10px 18px", borderRadius: "8px", fontWeight: "bold", cursor: driverActionLoading ? "not-allowed" : "pointer" }}
                  onClick={() => handleDecideDriver(selectedDriver.id_conductores, false)}
                  disabled={driverActionLoading}
                >
                  {driverActionLoading ? "Procesando..." : "Rechazar Conductor"}
                </button>
                <button
                  type="button"
                  style={{ background: "#16a34a", color: "#ffffff", border: 0, padding: "10px 22px", borderRadius: "8px", fontWeight: "bold", cursor: driverActionLoading ? "not-allowed" : "pointer" }}
                  onClick={() => handleDecideDriver(selectedDriver.id_conductores, true)}
                  disabled={driverActionLoading}
                >
                  {driverActionLoading ? "Aprobando..." : "Aprobar y Notificar"}
                </button>
              </div>
            </section>
          )}

          {/* Lightbox / Modal de ampliación de imagen */}
          {previewImage && (
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999999, display: "grid", placeItems: "center", padding: "16px" }}
              onClick={() => setPreviewImage(null)}
            >
              <div style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <img src={previewImage} alt="Licencia ampliada" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }} />
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  style={{ position: "absolute", top: "-14px", right: "-14px", background: "#ffffff", border: 0, borderRadius: "50%", width: "36px", height: "36px", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                >
                  ×
                </button>
              </div>
            </div>
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
              placeholder="Buscar conductor..."
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
                  <div style={{ fontSize: "0.9rem", color: assignedVehicle ? "#15803d" : "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                    {assignedVehicle ? (
                      <>
                        <IconCar size={16} color="#15803d" />
                        <span>Asignado: <strong>{assignedVehicle.nombre}</strong> ({assignedVehicle.numero_economico})</span>
                      </>
                    ) : (
                      <span>Sin unidad asignada</span>
                    )}
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

      {/* Modal de Firma Digital Compartido */}
      {showSignatureModal && (
        <SignaturePadModal
          title={activeTab === "gerenciamiento" ? "Firma Digital de Gerenciamiento" : activeTab === "manejo-comentado" ? "Firma Digital de Autorización" : "Firma Digital de Inspección"}
          subtitle="Dibuja tu firma digital con tu dedo o ratón dentro del recuadro."
          onSave={(sigData) => {
            setSignature(sigData);
            setShowSignatureModal(false);
          }}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </main>
  );
}
