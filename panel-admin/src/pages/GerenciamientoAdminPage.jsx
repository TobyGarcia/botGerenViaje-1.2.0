import { useEffect, useState } from "react";

export default function GerenciamientoAdminPage({ user }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRiesgo, setFilterRiesgo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Approval modal state
  const [approving, setApproving] = useState(false);
  const [autorizadorNombre, setAutorizadorNombre] = useState(user?.nombre || user?.username || "");
  const [observaciones, setObservaciones] = useState("");

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterRiesgo) params.append("nivelRiesgo", filterRiesgo);
      if (filterEstado) params.append("estado", filterEstado);

      const res = await fetch(`${API_BASE_URL}/api/gerenciamiento-viajes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error cargando registros");
      setList(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterRiesgo, filterEstado]);

  async function handleAprobarRechazar(nuevoEstado) {
    if (!selectedDoc) return;
    if (!autorizadorNombre.trim()) {
      alert("Ingresa el nombre del autorizador.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/gerenciamiento-viajes/${selectedDoc.id_gerenciamiento}/aprobar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idUsuarioAdmin: user?.id_usuarios_admin || null,
          nombreAutorizador: autorizadorNombre.trim(),
          estado: nuevoEstado,
          observaciones
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error procesando solicitud.");

      alert(`Gerenciamiento de viaje ${nuevoEstado.toLowerCase()} exitosamente.`);
      setSelectedDoc(null);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>🗺️ Gerenciamiento de Viajes (Fuera de Ciudad / Estado)</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            Revisión y aprobación de formatos de riesgo SII-MX-23-LOG-003 v3.0
          </p>
        </div>
        <button onClick={loadData} style={{ background: "#0284c7", color: "#fff", border: 0, padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
          🔄 Actualizar
        </button>
      </header>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "14px", background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Nivel de Riesgo:
          <select value={filterRiesgo} onChange={(e) => setFilterRiesgo(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">Todos los Riesgos</option>
            <option value="BAJO">🟢 Riesgo Bajo (0-15)</option>
            <option value="MEDIO">🟡 Riesgo Medio (16-23)</option>
            <option value="ALTO">🔴 Riesgo Alto (&gt;23)</option>
          </select>
        </label>

        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Estado:
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">Todos los Estados</option>
            <option value="PENDIENTE">⏳ Pendientes</option>
            <option value="APROBADO">✅ Aprobados</option>
            <option value="RECHAZADO">❌ Rechazados</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p>Cargando registros de gerenciamiento...</p>
      ) : error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : list.length === 0 ? (
        <div style={{ background: "#ffffff", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0", color: "#64748b" }}>
          No se encontraron documentos de gerenciamiento de viaje registradas.
        </div>
      ) : (
        <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                <th style={{ padding: "12px 14px" }}>Folio</th>
                <th style={{ padding: "12px 14px" }}>Fecha</th>
                <th style={{ padding: "12px 14px" }}>Conductor</th>
                <th style={{ padding: "12px 14px" }}>Origen / Destino</th>
                <th style={{ padding: "12px 14px" }}>Puntaje Total</th>
                <th style={{ padding: "12px 14px" }}>Nivel de Riesgo</th>
                <th style={{ padding: "12px 14px" }}>Autorización Requerida</th>
                <th style={{ padding: "12px 14px" }}>Estado</th>
                <th style={{ padding: "12px 14px", textAlign: "center" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                let badgeBg = "#16a34a";
                if (item.nivel_riesgo === "ALTO") badgeBg = "#dc2626";
                else if (item.nivel_riesgo === "MEDIO") badgeBg = "#ca8a04";

                return (
                  <tr key={item.id_gerenciamiento} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "bold" }}>{item.folio_documento} #{item.id_gerenciamiento}</td>
                    <td style={{ padding: "12px 14px" }}>{String(item.fecha_emision || "").split("T")[0]}</td>
                    <td style={{ padding: "12px 14px" }}>{item.nombre_conductor || item.conductor_nombre}</td>
                    <td style={{ padding: "12px 14px" }}>{item.origen_nombre || "N/A"} ➔ {item.destino_nombre || "N/A"}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "bold" }}>{item.puntaje_total} ptos</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: badgeBg, color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                        {item.nivel_riesgo}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: "0.8rem", color: "#334155" }}>{item.autorizacion_requerida}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: "bold",
                        background: item.estado === "APROBADO" ? "#dcfce7" : item.estado === "RECHAZADO" ? "#fee2e2" : "#fef9c3",
                        color: item.estado === "APROBADO" ? "#166534" : item.estado === "RECHAZADO" ? "#991b1b" : "#854d0e"
                      }}>
                        {item.estado}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button onClick={() => setSelectedDoc(item)} style={{ background: "#1e3a8a", color: "#fff", border: 0, padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem" }}>
                        👁️ Ver Detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalle / Aprobación */}
      {selectedDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "grid", placeItems: "center", padding: "16px", overflowY: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", maxWidth: "800px", width: "100%", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "10px", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>📄 Documento de Gerenciamiento Vehicular {selectedDoc.folio_documento}</h2>
              <button onClick={() => setSelectedDoc(null)} style={{ background: "transparent", border: 0, fontSize: "1.4rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* Document Header info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "14px", fontSize: "0.88rem" }}>
              <div><strong>Conductor:</strong> {selectedDoc.nombre_conductor}</div>
              <div><strong>Fecha Emisión:</strong> {String(selectedDoc.fecha_emision).split("T")[0]}</div>
              <div><strong>Origen/Destino:</strong> {selectedDoc.origen_nombre} ➔ {selectedDoc.destino_nombre}</div>
              <div><strong>Hora Salida / KM:</strong> {selectedDoc.hora_salida} / {selectedDoc.kilometraje} km</div>
              <div><strong>Presión / Glucosa:</strong> {selectedDoc.presion_arterial || "N/A"} / {selectedDoc.glucosa || "N/A"}</div>
              <div><strong>Alcoholímetro:</strong> {selectedDoc.alcoholimetro ? "POSITIVO (+)" : "NEGATIVO (0.00)"}</div>
            </div>

            {/* Matriz de Riesgo */}
            <div style={{ background: "#f1f5f9", padding: "14px", borderRadius: "8px", marginBottom: "16px", borderLeft: `6px solid ${selectedDoc.nivel_riesgo === 'ALTO' ? '#dc2626' : selectedDoc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a'}` }}>
              <h4 style={{ margin: "0 0 6px", color: "#0f172a" }}>Puntaje Total: {selectedDoc.puntaje_total} ptos — RIESGO {selectedDoc.nivel_riesgo}</h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}><strong>Autorización Requerida:</strong> {selectedDoc.autorizacion_requerida}</p>
            </div>

            {/* Firma del Conductor */}
            {selectedDoc.firma_conductor && (
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ fontSize: "0.85rem" }}>Firma del Conductor:</strong>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: "6px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>
                  <img src={selectedDoc.firma_conductor} alt="Firma Conductor" style={{ maxHeight: "90px" }} />
                </div>
              </div>
            )}

            {/* Formulario de Aprobación */}
            <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: "14px", marginTop: "14px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#1e3a8a" }}>✍️ Firma y Aprobación del Autorizador</h4>
              <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Nombre del Autorizador:
                  <input type="text" value={autorizadorNombre} onChange={(e) => setAutorizadorNombre(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </label>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Observaciones / Acciones de Control:
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} placeholder="Detalle acciones de control o notas de aprobación" />
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => handleAprobarRechazar("RECHAZADO")} disabled={approving} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  ❌ Rechazar Viaje
                </button>
                <button onClick={() => handleAprobarRechazar("APROBADO")} disabled={approving} style={{ background: "#16a34a", color: "#fff", border: 0, padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  ✅ Aprobar y Autorizar Viaje
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
