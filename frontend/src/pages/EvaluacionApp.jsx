import { Component, useEffect, useRef, useState } from "react";
import "../App.css";

const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_BASE_URL = configuredApiBaseUrl.replace(/\/api$/, "");

const rubrosDef = [
  { id: "inspeccion_previa", title: "1. Inspección Pre-operacional", points: 15 },
  { id: "postura_cinturon", title: "2. Postura y Cinturón de Seguridad", points: 10 },
  { id: "espejos_puntos_ciegos", title: "3. Ajuste/Uso de Espejos y Puntos Ciegos", points: 10 },
  { id: "arranque_aceleracion", title: "4. Arranque y Aceleración Graduada", points: 10 },
  { id: "frenado_distancia", title: "5. Distancia de Seguimiento y Frenado", points: 15 },
  { id: "direccionales_carril", title: "6. Uso de Direccionales y Carril", points: 10 },
  { id: "respeto_senales", title: "7. Respeto a Límites y Señales de Tránsito", points: 15 },
  { id: "comentarios_orales", title: "8. Manejo Comentado (Conciencia Situacional)", points: 15 }
];

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error en EvaluacionApp:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", maxWidth: "480px", margin: "2rem auto" }}>
          <h2>Ocurrió un problema al cargar la evaluación</h2>
          <p style={{ color: "#dc2626", margin: "1rem 0" }}>{this.state.error?.message || "Error desconocido"}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reintentar / Cargar de nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function EvaluacionApp(props) {
  return (
    <ErrorBoundary>
      <EvaluacionAppContent {...props} />
    </ErrorBoundary>
  );
}

function EvaluacionAppContent({ user: initialUser = null, onLogout }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState([]);
  const [user, setUser] = useState(initialUser);
  const [loadingSession, setLoadingSession] = useState(!initialUser);

  // Formulario Login
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Datos para Evaluación
  const [conductores, setConductores] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [nombreInstructor, setNombreInstructor] = useState(initialUser?.nombre || "");
  const [comentarios, setComentarios] = useState("");
  const [rubrica, setRubrica] = useState(() => {
    const initial = {};
    rubrosDef.forEach((r) => { initial[r.id] = r.points; });
    return initial;
  });

  // Canvas Firma Digital
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");

  useEffect(() => {
    if (user?.nombre && !nombreInstructor) {
      setNombreInstructor(user.nombre);
    }
  }, [user]);

  // Manejo de conexión offline/online
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncLocalQueue(); };
    const handleOffline = () => { setIsOnline(false); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadLocalQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function loadLocalQueue() {
    try {
      const stored = localStorage.getItem("evaluaciones_offline_queue");
      if (stored) setPendingSync(JSON.parse(stored));
    } catch {
      setPendingSync([]);
    }
  }

  function saveToLocalQueue(evalData) {
    try {
      const queue = JSON.parse(localStorage.getItem("evaluaciones_offline_queue") || "[]");
      queue.push({ ...evalData, localId: Date.now() });
      localStorage.setItem("evaluaciones_offline_queue", JSON.stringify(queue));
      setPendingSync(queue);
    } catch (e) {
      console.error("Error al guardar localmente:", e);
    }
  }

  async function syncLocalQueue() {
    const queue = JSON.parse(localStorage.getItem("evaluaciones_offline_queue") || "[]");
    if (queue.length === 0) return;

    setStatusMessage(`Sincronizando ${queue.length} evaluación(es) pendientes...`);
    setStatusType("info");

    const remaining = [];
    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/manejo-comentado/evaluar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(item)
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem("evaluaciones_offline_queue", JSON.stringify(remaining));
    setPendingSync(remaining);

    if (remaining.length === 0) {
      setStatusMessage("¡Todas las evaluaciones pendientes se sincronizaron con éxito!");
      setStatusType("success");
    } else {
      setStatusMessage(`Quedan ${remaining.length} evaluación(es) pendientes por sincronizar.`);
      setStatusType("warning");
    }
  }

  // Verificar Sesión si no viene por props
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setNombreInstructor(initialUser.nombre || "");
      setLoadingSession(false);
      loadConductores();
      return;
    }

    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/auth/session`, { credentials: "include" });
        const data = await res.json();
        if (res.ok && (data.data?.user || data.user)) {
          const loggedUser = data.data?.user || data.user;
          setUser(loggedUser);
          setNombreInstructor(loggedUser.nombre || "");
          loadConductores();
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [initialUser]);

  async function loadConductores() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/manejo-comentado/conductores`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data && data.data) {
        setConductores(data.data);
      } else {
        const catRes = await fetch(`${API_BASE_URL}/api/catalogos/conductores`, { credentials: "include" });
        const catData = await catRes.json();
        if (catRes.ok && catData) {
          setConductores(Array.isArray(catData) ? catData : (catData.data || []));
        }
      }
    } catch (err) {
      console.warn("No fue posible cargar conductores:", err);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Credenciales incorrectas.");
      const loggedUser = data.data?.user || data.user;
      setUser(loggedUser);
      setNombreInstructor(loggedUser.nombre || "");
      loadConductores();
    } catch (err) {
      setLoginError(err.message);
    }
  }

  // Lógica del Canvas de Firma Digital
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getCoordinates(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const calificacionTotal = Object.values(rubrica).reduce((sum, val) => sum + Number(val || 0), 0);
  const estadoEvaluacion = calificacionTotal >= 70 ? "APROBADO" : "REPROBADO";

  function handleRubroScoreChange(id, value) {
    setRubrica((prev) => ({ ...prev, [id]: Number(value) }));
  }

  async function handleSubmitEvaluation(e) {
    e.preventDefault();
    if (!selectedDriverId) {
      setStatusMessage("Debes seleccionar un conductor.");
      setStatusType("error");
      return;
    }

    if (!nombreInstructor.trim()) {
      setStatusMessage("Debes proporcionar el nombre del instructor / evaluador.");
      setStatusType("error");
      return;
    }

    if (!hasSignature) {
      setStatusMessage("Debes firmar la evaluación en el recuadro digital antes de guardar.");
      setStatusType("error");
      return;
    }

    setSaving(true);
    setStatusMessage("");

    const signatureDataUrl = canvasRef.current ? canvasRef.current.toDataURL("image/png") : "";

    const evalPayload = {
      idConductor: Number(selectedDriverId),
      nombreInstructor: nombreInstructor.trim(),
      firmaDataUrl: signatureDataUrl,
      calificacion: calificacionTotal,
      comentarios,
      rubrica
    };

    if (!isOnline) {
      saveToLocalQueue(evalPayload);
      setStatusMessage("Sin conexión a internet. La evaluación se guardó LOCALMENTE y se subirá automáticamente cuando se restablezca la conexión.");
      setStatusType("warning");
      resetForm();
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/manejo-comentado/evaluar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(evalPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar la evaluación.");

      setStatusMessage(`Evaluación registrada con éxito. Resultado: ${estadoEvaluacion} (${calificacionTotal}/100)`);
      setStatusType("success");
      resetForm();
    } catch (err) {
      saveToLocalQueue(evalPayload);
      setStatusMessage("Error de red. La evaluación fue guardada en el dispositivo y se reintentará subir en breve.");
      setStatusType("warning");
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedDriverId("");
    setComentarios("");
    clearSignature();
    const initial = {};
    rubrosDef.forEach((r) => { initial[r.id] = r.points; });
    setRubrica(initial);
  }

  if (loadingSession) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p>Cargando aplicativo de evaluación...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: "420px", marginTop: "2rem", padding: "1.5rem" }}>
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", color: "#2e81ab", margin: "0 0 6px" }}>Manejo Comentado</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>Acceso para Instructores / Evaluadores</p>
        </header>

        <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            Usuario Administrativo / Instructor
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            Contraseña
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              required
            />
          </label>

          <button type="submit" className="primary-button" style={{ padding: "12px", marginTop: "8px" }}>
            Iniciar Sesión
          </button>
        </form>

        {loginError && <p className="message message-error" style={{ marginTop: "1rem" }}>{loginError}</p>}
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: "560px", padding: "1rem 1rem 3rem" }}>
      {/* Bar Estado Conexión */}
      <div style={{
        display: "flex",
        justify: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: isOnline ? "#ecfdf5" : "#fffbeb",
        border: `1px solid ${isOnline ? "#a7f3d0" : "#fef08a"}`,
        marginBottom: "1rem",
        fontSize: "0.85rem"
      }}>
        <span>
          {isOnline ? "🟢 Conectado" : "🟠 Sin Conexión (Modo Offline)"}
        </span>
        {pendingSync.length > 0 && (
          <span style={{ color: "#d97706", fontWeight: "bold" }}>
            {pendingSync.length} pendiente(s) por subir
          </span>
        )}
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", margin: 0, color: "#2e81ab" }}>Evaluación Práctica Móvil</h1>
          <small style={{ color: "#64748b" }}>Instructor: {user.nombre} ({user.rol})</small>
        </div>

        {onLogout && (
          <button
            type="button"
            className="secondary-button"
            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
            onClick={onLogout}
          >
            Salir
          </button>
        )}
      </header>

      {statusMessage && (
        <div className={`message message-${statusType}`} style={{ marginBottom: "1rem" }}>
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleSubmitEvaluation}>
        <label style={{ marginBottom: "1.2rem", display: "block" }}>
          <strong>Conductor a Evaluar *</strong>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            required
          >
            <option value="">-- Seleccionar Conductor --</option>
            {conductores.map((c) => (
              <option key={c.id_conductores} value={c.id_conductores}>
                {c.nombre} ({c.empresa || "Sin Empresa"})
              </option>
            ))}
          </select>
        </label>

        {/* Rubros de Evaluación */}
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", marginBottom: "1.2rem" }}>
          <legend style={{ padding: "0 6px", fontWeight: "bold", color: "#1e293b" }}>
            Rubro y Puntuación
          </legend>

          {rubrosDef.map((r) => (
            <div key={r.id} style={{ marginBottom: "1rem", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>{r.title}</span>
                <span style={{ color: "#0284c7" }}>{rubrica[r.id]} / {r.points} pts</span>
              </div>
              <input
                type="range"
                min="0"
                max={r.points}
                value={rubrica[r.id]}
                onChange={(e) => handleRubroScoreChange(r.id, e.target.value)}
                className="evaluation-slider"
                style={{
                  width: "100%",
                  "--value-percent": `${(rubrica[r.id] / r.points) * 100}%`
                }}
              />
            </div>
          ))}
        </fieldset>

        {/* Cajas de Calificación Total */}
        <div style={{
          padding: "12px",
          borderRadius: "8px",
          textAlign: "center",
          backgroundColor: estadoEvaluacion === "APROBADO" ? "#f0fdf4" : "#fef2f2",
          border: `2px solid ${estadoEvaluacion === "APROBADO" ? "#22c55e" : "#ef4444"}`,
          marginBottom: "1.2rem"
        }}>
          <span style={{ fontSize: "0.9rem", color: "#475569" }}>Calificación Total:</span>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: estadoEvaluacion === "APROBADO" ? "#15803d" : "#b91c1c" }}>
            {calificacionTotal} / 100
          </div>
          <strong style={{ fontSize: "1.1rem", color: estadoEvaluacion === "APROBADO" ? "#166534" : "#991b1b" }}>
            {estadoEvaluacion}
          </strong>
        </div>

        <label style={{ display: "block", marginBottom: "1.2rem" }}>
          <strong>Observaciones y Comentarios del Instructor</strong>
          <textarea
            rows="3"
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Retroalimentación para el conductor..."
            style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </label>

        {/* Firma y Datos del Instructor */}
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", marginBottom: "1.5rem" }}>
          <legend style={{ padding: "0 6px", fontWeight: "bold", color: "#1e293b" }}>
            Datos y Firma Digital del Instructor *
          </legend>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <strong>Nombre del Instructor / Evaluador *</strong>
            <input
              type="text"
              value={nombreInstructor}
              onChange={(e) => setNombreInstructor(e.target.value)}
              placeholder="Nombre completo del instructor"
              style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              required
            />
          </label>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <strong>Firma Digital del Instructor *</strong>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                onClick={clearSignature}
              >
                Limpiar Firma
              </button>
            </div>

            <div style={{ border: "2px dashed #94a3b8", borderRadius: "8px", background: "#f8fafc", padding: "4px", textAlign: "center" }}>
              <canvas
                ref={canvasRef}
                width={480}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ width: "100%", height: "140px", touchAction: "none", background: "#ffffff", borderRadius: "6px" }}
              />
            </div>
            <small style={{ color: "#64748b", display: "block", marginTop: "4px", textAlign: "center" }}>
              Utiliza tu dedo o stylus sobre el recuadro blanco para firmar la evaluación.
            </small>
          </div>
        </fieldset>

        <button
          type="submit"
          className="primary-button"
          disabled={saving}
          style={{ width: "100%", padding: "12px", fontSize: "1rem" }}
        >
          {saving ? "Procesando..." : isOnline ? "Guardar y Subir Evaluación" : "Guardar Localmente (Offline)"}
        </button>
      </form>
    </div>
  );
}
