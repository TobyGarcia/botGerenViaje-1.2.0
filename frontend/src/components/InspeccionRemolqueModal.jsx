import { useState } from "react";
import { createPortal } from "react-dom";
import remolqueFrontalImg from "../assets/remolque_frontal.png";
import remolqueDerechaImg from "../assets/remolque_derecha.png";
import remolqueTraseraImg from "../assets/remolque_trasera.png";
import remolqueIzquierdoImg from "../assets/remolque_izquierdo.png";

const TRAILER_IMAGES = {
  frontal: remolqueFrontalImg,
  derecha: remolqueDerechaImg,
  trasera: remolqueTraseraImg,
  izquierda: remolqueIzquierdoImg
};

export const REMOLQUE_CHECKLIST_GROUPS = {
  "Documentación / Control": [
    "Identificación o número económico visible",
    "Placa del remolque (si aplica)",
    "Tarjeta de circulación vigente (si aplica)",
    "Movimiento solicitado previamente",
    "Supervisora vehicular notificada",
    "Destino y responsable registrados"
  ],
  "Sistema de Enganche y Seguridad": [
    "Acoplador / enganche sin deformaciones",
    "Seguro o pasador del acoplador",
    "Cadenas de seguridad",
    "Ganchos de cadenas",
    "Cable de seguridad / breakaway (si aplica)",
    "Conector eléctrico",
    "Punto de enganche libre de fisuras",
    "Tornillería y fijaciones del enganche"
  ],
  "Soportes y Elevación": [
    "Gato / soporte de elevación recto y funcional",
    "Manivela del gato",
    "Base / zapata del soporte",
    "Soportes estabilizadores (si aplica)",
    "Pasadores y seguros",
    "Soldaduras sin fisuras o deformaciones"
  ],
  "Llantas, Rines y Ejes": [
    "Llanta delantera derecha",
    "Llanta delantera izquierda",
    "Llanta trasera derecha (si aplica)",
    "Llanta trasera izquierda (si aplica)",
    "Presión visual / inflado adecuado",
    "Desgaste o cortes en neumáticos",
    "Rines sin golpes o deformaciones",
    "Birlos completos y firmes",
    "Ejes / suspensión sin daño visible",
    "Llanta de refacción (si aplica)"
  ],
  "Luces y Sistema Eléctrico": [
    "Calavera trasera derecha",
    "Calavera trasera izquierda",
    "Luces direccionales",
    "Luces de freno",
    "Luces de posición / cuartos",
    "Luces de placa (si aplica)",
    "Reflectores",
    "Cableado sin exposición o daño",
    "Conector y terminales en buen estado"
  ],
  "Estructura y Carrocería": [
    "Chasis sin golpes o deformaciones",
    "Piso / plataforma",
    "Laterales / barandales (si aplica)",
    "Salpicaderas",
    "Defensa / parte posterior",
    "Soldaduras visibles",
    "Rampas / compuertas (si aplica)",
    "Bisagras y seguros",
    "Ausencia de piezas flojas"
  ],
  "Carga y Operación": [
    "Carga correctamente distribuida",
    "Carga asegurada con cinchos/cadenas (si aplica)",
    "Capacidad de carga respetada",
    "Sin objetos sueltos",
    "Rampas aseguradas antes del traslado",
    "Freno de remolque funcional (si aplica)"
  ],
  "Limpieza y Condición General": [
    "Interior / plataforma limpia",
    "Exterior limpio",
    "Sin residuos, lodo o materiales sueltos",
    "Condición general apta para traslado"
  ]
};

const TRAILER_VIEWS = [
  { id: "frontal", label: "Vista Frontal", title: "Vista Frontal de Remolque" },
  { id: "derecha", label: "Vista Lateral Derecha", title: "Vista Lateral Derecha" },
  { id: "trasera", label: "Vista Trasera", title: "Vista Trasera" },
  { id: "izquierda", label: "Vista Lateral Izquierda", title: "Vista Lateral Izquierda" }
];

export default function InspeccionRemolqueModal({ vehiculos = [], initialData = {}, onSave, onClose }) {
  // Filtrar unidades que contengan "remolque" en nombre, tipo o económico
  const remolquesCatalog = vehiculos.filter((v) => {
    const text = `${v.nombre || ""} ${v.tipo_vehiculo || ""} ${v.marca || ""} ${v.modelo || ""} ${v.numero_economico || ""}`.toLowerCase();
    return text.includes("remolque");
  });

  const availableRemolques = remolquesCatalog.length > 0 ? remolquesCatalog : vehiculos;

  const [idRemolque, setIdRemolque] = useState(
    initialData?.idRemolque ? String(initialData.idRemolque) : (availableRemolques[0]?.id_vehiculos ? String(availableRemolques[0].id_vehiculos) : "")
  );

  const [activeTab, setActiveTab] = useState("checklist"); // 'checklist' | 'danos'
  const [checklist, setChecklist] = useState(initialData?.checklist || {});
  const [danos, setDanos] = useState(initialData?.danos || { frontal: [], derecha: [], trasera: [], izquierda: [] });
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "");
  const [activeView, setActiveView] = useState("frontal");

  const selectedTrailerObj = availableRemolques.find((v) => String(v.id_vehiculos) === String(idRemolque)) || availableRemolques[0] || {};

  function handleChecklistChange(item, value) {
    setChecklist((prev) => ({ ...prev, [item]: value }));
  }

  function handleMarkDamage(viewId, event) {
    event.preventDefault();
    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clientX = event.clientX !== undefined ? event.clientX : event.touches?.[0]?.clientX;
    const clientY = event.clientY !== undefined ? event.clientY : event.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const offsetY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const point = {
      x: Number(((offsetX / rect.width) * 100).toFixed(2)),
      y: Number(((offsetY / rect.height) * 100).toFixed(2))
    };

    setDanos((prev) => ({
      ...prev,
      [viewId]: [...(prev[viewId] || []), point]
    }));
  }

  function handleRemoveDamagePoint(viewId, index, event) {
    event.stopPropagation();
    setDanos((prev) => ({
      ...prev,
      [viewId]: (prev[viewId] || []).filter((_, i) => i !== index)
    }));
  }

  function handleSave() {
    if (!idRemolque) {
      alert("Por favor selecciona la unidad de Remolque.");
      return;
    }
    onSave({
      idRemolque: Number(idRemolque),
      remolqueObj: selectedTrailerObj,
      checklist,
      danos,
      observaciones
    });
  }

  return createPortal(
    <div className="signature-dialog" role="dialog" aria-modal="true" style={{ zIndex: 2147483002 }}>
      <div className="signature-dialog-card" style={{ maxWidth: "750px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        {/* Encabezado */}
        <div className="signature-dialog-heading" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "700", color: "#2563eb" }}>Formato Oficial</span>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🚛 Inspección de Remolque</h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>Checklist previo a traslado | Logística / Infraestructura</p>
          </div>
          <button type="button" className="inspection-icon-button" onClick={onClose} aria-label="Cerrar modal">×</button>
        </div>

        {/* Selección de Remolque */}
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 14px", margin: "12px 0 6px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
            Unidad de Remolque a Inspeccionar:
          </label>
          <select
            value={idRemolque}
            onChange={(e) => setIdRemolque(e.target.value)}
            style={{ width: "100%", height: "38px", borderRadius: "6px", border: "1px solid #94a3b8", padding: "0 10px", fontWeight: "600", fontSize: "0.85rem" }}
          >
            {availableRemolques.map((v) => (
              <option key={v.id_vehiculos} value={v.id_vehiculos}>
                {v.numero_economico} - {v.nombre} ({v.placas || "Sin placas"}) {v.marca ? `| ${v.marca}` : ""}
              </option>
            ))}
          </select>
          {remolquesCatalog.length === 0 && (
            <span style={{ fontSize: "0.72rem", color: "#d97706", marginTop: "4px", display: "block" }}>
              ⚠️ No se encontraron unidades con la palabra "Remolque" en el catálogo. Se muestran todas las unidades disponibles.
            </span>
          )}
        </div>

        {/* Pestañas: Checklist vs Diagrama de Daños */}
        <div style={{ display: "flex", gap: "8px", margin: "6px 0 10px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: activeTab === "checklist" ? "2px solid #2563eb" : "1px solid #cbd5e1",
              background: activeTab === "checklist" ? "#eff6ff" : "#ffffff",
              color: activeTab === "checklist" ? "#1d4ed8" : "#475569",
              fontWeight: "700",
              fontSize: "0.82rem",
              cursor: "pointer"
            }}
          >
            📋 Checklist de Control (8 Secciones)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("danos")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: activeTab === "danos" ? "2px solid #2563eb" : "1px solid #cbd5e1",
              background: activeTab === "danos" ? "#eff6ff" : "#ffffff",
              color: activeTab === "danos" ? "#1d4ed8" : "#475569",
              fontWeight: "700",
              fontSize: "0.82rem",
              cursor: "pointer"
            }}
          >
            🎨 Diagrama 4 Vistas y Daños
          </button>
        </div>

        {/* Contenido deslizable */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
          
          {activeTab === "checklist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {Object.entries(REMOLQUE_CHECKLIST_GROUPS).map(([groupTitle, items]) => (
                <div key={groupTitle} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ background: "#1e293b", color: "#ffffff", padding: "6px 12px", fontWeight: "700", fontSize: "0.8rem", textTransform: "uppercase" }}>
                    {groupTitle}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {items.map((item, idx) => {
                      const val = checklist[item] || "B";
                      return (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                            borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                            fontSize: "0.8rem"
                          }}
                        >
                          <span style={{ flex: 1, paddingRight: "10px", color: "#334155", fontWeight: "500" }}>{item}</span>
                          <div style={{ display: "flex", gap: "4px" }}>
                            {["B", "R", "M", "N/A"].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleChecklistChange(item, opt)}
                                style={{
                                  width: "34px",
                                  height: "28px",
                                  borderRadius: "4px",
                                  border: val === opt ? "2px solid #000" : "1px solid #cbd5e1",
                                  background:
                                    val === opt
                                      ? opt === "B" ? "#22c55e" : opt === "R" ? "#eab308" : opt === "M" ? "#ef4444" : "#64748b"
                                      : "#f1f5f9",
                                  color: val === opt ? "#ffffff" : "#475569",
                                  fontWeight: "800",
                                  fontSize: "0.72rem",
                                  cursor: "pointer"
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ margin: "6px 0" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>
                  Observaciones / Daños Detectados en Remolque:
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Escribe observaciones o detalles de daños en el remolque..."
                  style={{ width: "100%", height: "70px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "8px", fontSize: "0.8rem" }}
                />
              </div>
            </div>
          )}

          {activeTab === "danos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {TRAILER_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveView(v.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: activeView === v.id ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: activeView === v.id ? "#2563eb" : "#f8fafc",
                      color: activeView === v.id ? "#ffffff" : "#334155",
                      fontWeight: "700",
                      fontSize: "0.75rem",
                      cursor: "pointer"
                    }}
                  >
                    {v.label} ({(danos[v.id] || []).length})
                  </button>
                ))}
              </div>

              {/* Área interactiva de marcado para Remolque */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "#1e293b" }}>
                  {TRAILER_VIEWS.find((v) => v.id === activeView)?.title}
                </h4>
                <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "#64748b" }}>
                  Toca sobre el diagrama del remolque para marcar una abolladura o daño. Toca el punto rojo para eliminarlo.
                </p>

                <div
                  onClick={(e) => handleMarkDamage(activeView, e)}
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "500px",
                    height: "220px",
                    margin: "0 auto",
                    border: "2px dashed #94a3b8",
                    borderRadius: "8px",
                    background: "#ffffff",
                    cursor: "crosshair",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {/* Imagen Diagrama de Remolque */}
                  <img
                    src={TRAILER_IMAGES[activeView]}
                    alt={`Remolque ${activeView}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                  />

                  {/* Marcas rojas de daño */}
                  {(danos[activeView] || []).map((pt, idx) => (
                    <div
                      key={idx}
                      onClick={(e) => handleRemoveDamagePoint(activeView, idx, e)}
                      title="Haz clic para eliminar este punto de daño"
                      style={{
                        position: "absolute",
                        left: `${pt.x}%`,
                        top: `${pt.y}%`,
                        transform: "translate(-50%, -50%)",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "#ef4444",
                        border: "2px solid #ffffff",
                        boxShadow: "0 0 6px rgba(239, 68, 68, 0.8)",
                        color: "#ffffff",
                        fontSize: "0.65rem",
                        fontWeight: "900",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer"
                      }}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                    Total marcas en {activeView}: <strong>{(danos[activeView] || []).length}</strong>
                  </span>
                  {(danos[activeView] || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDanos((prev) => ({ ...prev, [activeView]: [] }))}
                      style={{ background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer" }}
                    >
                      Limpiar marcas de vista {activeView}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal / Acciones */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "8px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="inspection-secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="inspection-primary-button" onClick={handleSave}>
            Guardar Inspección de Remolque
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
