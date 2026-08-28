import { useEffect, useState } from "react";
import "../App.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "").replace(/\/api$/, "");

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

export default function EvaluacionApp() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Formulario Login
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Datos para Evaluación
  const [conductores, setConductores] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [rubrica, setRubrica] = useState(() => {
    const initial = {};
    rubrosDef.forEach((r) => { initial[r.id] = r.points; });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");

  // Manejo de conexión offline/online
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncLocalQueue(); };
    const handleOffline = () => { setIsOnline(false); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cargar cola local al iniciar
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

  // Verificar Sesión
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/auth/session`, { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.data?.user) {
          setUser(data.data.user);
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
  }, []);

  async function loadConductores() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/catalogos/conductores`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data) {
        setConductores(data);
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
      setUser(data.data.user);
      loadConductores();
    } catch (err) {
      setLoginError(err.message);
    }
  }

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

    setSaving(true);
    setStatusMessage("");

    const evalPayload = {
      idConductor: Number(selectedDriverId),
      calificacion: calificacionTotal,
      comentarios,
      rubrica
    };

    if (!isOnline) {
      // Guardar en cola offline
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
      // Si falla la petición HTTP (ej. perdida repentina de señal), guardar localmente
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
    const initial = {};
    rubrosDef.forEach((r) => { initial[r.id] = r.points; });
    setRubrica(initial);
  }

  if (loadingSession) {
    return <div className="container"><p>Cargando aplicativo de evaluación...</p></div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: "420px", marginTop: "2rem" }}>
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Manejo Comentado</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Acceso para Instructores / Evaluadores</p>
        </header>

        <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label>
            Usuario Administrativo / Instructor
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
          </label>

          <button type="submit" className="primary-button">Iniciar Sesión</button>
        </form>

        {loginError && <p className="message message-error" style={{ marginTop: "1rem" }}>{loginError}</p>}
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: "560px", paddingBottom: "3rem" }}>
      {/* Indicator Bar */}
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

      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Evaluación Práctica Móvil</h1>
        <small style={{ color: "#64748b" }}>Instructor: {user.nombre} ({user.rol})</small>
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
            style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px" }}
            required
          >
            <option value="">-- Seleccionar Conductor --</option>
            {conductores.map((c) => (
              <option key={c.id_conductores} value={c.id_conductores}>
                {c.nombre}
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
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </fieldset>

        {/* Total & Status Box */}
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
            style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px" }}
          />
        </label>

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
