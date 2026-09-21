import { useState } from "react";
import { createPortal } from "react-dom";
import remolqueFrontalImg from "../assets/remolque_frontal.png";
import remolqueDerechaImg from "../assets/remolque_derecha.png";
import remolqueTraseraImg from "../assets/remolque_trasera.png";
import remolqueIzquierdoImg from "../assets/remolque_izquierdo.png";

const views = [
  ["frontal", "🚘 Vista frontal del remolque", remolqueFrontalImg],
  ["derecha", "🚙 Lateral derecho del remolque", remolqueDerechaImg],
  ["trasera", "🚗 Vista trasera del remolque", remolqueTraseraImg],
  ["izquierda", "🚙 Lateral izquierdo del remolque", remolqueIzquierdoImg]
];

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

const STATE_TO_NUM = { "N/A": 0, "M": 1, "R": 2, "B": 3 };
const NUM_TO_STATE = { 0: "N/A", 1: "M", 2: "R", 3: "B" };

export default function InspeccionRemolqueModal({ vehiculos = [], initialData = {}, onSave, onClose }) {
  // Filtrar unidades que contengan "remolque" en nombre, tipo o económico
  const remolquesCatalog = vehiculos.filter((v) => {
    const text = `${v.nombre || ""} ${v.tipo_vehiculo || ""} ${v.marca || ""} ${v.modelo || ""} ${v.numero_economico || ""}`.toLowerCase();
    return text.includes("remolque");
  });

  const availableRemolques = remolquesCatalog.length > 0 ? remolquesCatalog : vehiculos;

  const [step, setStep] = useState(0);
  const [idRemolque, setIdRemolque] = useState(
    initialData?.idRemolque ? String(initialData.idRemolque) : (availableRemolques[0]?.id_vehiculos ? String(availableRemolques[0].id_vehiculos) : "")
  );

  const [checklist, setChecklist] = useState(initialData?.checklist || {});
  const [danos, setDanos] = useState(initialData?.danos || { frontal: [], derecha: [], trasera: [], izquierda: [] });
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "");
  const [lastMarked, setLastMarked] = useState("");

  const totalSteps = 7;
  const currentView = step >= 1 && step <= 4 ? views[step - 1] : null;
  const selectedTrailerObj = availableRemolques.find((v) => String(v.id_vehiculos) === String(idRemolque)) || availableRemolques[0] || {};

  function chooseChecklist(item, value) {
    setChecklist((prev) => ({ ...prev, [item]: value }));
  }

  function markAllChecklistAsGood() {
    const updated = { ...checklist };
    Object.values(REMOLQUE_CHECKLIST_GROUPS).flat().forEach((item) => {
      updated[item] = "B";
    });
    setChecklist(updated);
  }

  function markDamage(view, event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const stage = event.currentTarget;
    const img = stage.querySelector("img");
    const targetRect = img ? img.getBoundingClientRect() : stage.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;

    const clientX = event.clientX !== undefined ? event.clientX : event.touches?.[0]?.clientX;
    const clientY = event.clientY !== undefined ? event.clientY : event.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const offsetX = Math.max(0, Math.min(targetRect.width, clientX - targetRect.left));
    const offsetY = Math.max(0, Math.min(targetRect.height, clientY - targetRect.top));

    const point = {
      x: Number(((offsetX / targetRect.width) * 100).toFixed(2)),
      y: Number(((offsetY / targetRect.height) * 100).toFixed(2))
    };

    setDanos((prev) => ({
      ...prev,
      [view]: [...(prev[view] || []), point]
    }));
    setLastMarked("Marca agregada. Toca el círculo rojo para eliminarlo.");
  }

  function removePoint(view, index, event) {
    event.preventDefault();
    event.stopPropagation();
    setDanos((prev) => ({
      ...prev,
      [view]: (prev[view] || []).filter((_, pointIndex) => pointIndex !== index)
    }));
    setLastMarked("Marca eliminada.");
  }

  function clearView(view) {
    setDanos((prev) => ({ ...prev, [view]: [] }));
    setLastMarked("Se limpiaron las marcas de esta vista.");
  }

  function canContinue() {
    if (step === 0) return Boolean(idRemolque);
    return true;
  }

  function handleSave() {
    if (!idRemolque) {
      alert("Por favor selecciona la unidad de Remolque.");
      return;
    }
    const finalChecklist = { ...checklist };
    Object.values(REMOLQUE_CHECKLIST_GROUPS).flat().forEach((item) => {
      if (!finalChecklist[item]) finalChecklist[item] = "B";
    });

    onSave({
      idRemolque: Number(idRemolque),
      remolqueObj: selectedTrailerObj,
      checklist: finalChecklist,
      danos,
      observaciones
    });
  }

  // Conteos para el resumen final
  const totalDamagesCount = Object.values(danos).reduce((acc, pts) => acc + (pts?.length || 0), 0);
  const allChecklistItems = Object.values(REMOLQUE_CHECKLIST_GROUPS).flat();
  const goodCount = allChecklistItems.filter((i) => (checklist[i] || "B") === "B").length;
  const regularCount = allChecklistItems.filter((i) => checklist[i] === "R").length;
  const badCount = allChecklistItems.filter((i) => checklist[i] === "M").length;
  const naCount = allChecklistItems.filter((i) => checklist[i] === "N/A").length;

  return createPortal(
    <div className="signature-dialog" role="dialog" aria-modal="true" style={{ zIndex: 2147483002 }}>
      <div
        className="signature-dialog-card"
        style={{
          maxWidth: "760px",
          width: "95vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "20px"
        }}
      >
        {/* Encabezado del Wizard */}
        <header className="inspection-header">
          <div>
            <span>🚛 Inspección de Remolque</span>
            <h2>Paso {step + 1} de {totalSteps}</h2>
          </div>
          <button type="button" className="inspection-icon-button" onClick={onClose} aria-label="Cerrar modal">
            ×
          </button>
          <progress value={step + 1} max={totalSteps} />
        </header>

        {/* Contenido deslizable del Paso */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>

          {/* PASO 1: Datos y Selección de la Unidad de Remolque */}
          {step === 0 && (
            <div className="inspection-cover" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: "#173f51" }}>
                  Selección de la Unidad de Remolque
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#607986" }}>
                  Selecciona la unidad de remolque asignada al viaje para iniciar su revisión.
                </p>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Unidad de Remolque a Inspeccionar:
                </label>
                <select
                  value={idRemolque}
                  onChange={(e) => setIdRemolque(e.target.value)}
                  style={{ width: "100%", height: "42px", borderRadius: "8px", border: "1px solid #94a3b8", padding: "0 12px", fontWeight: "600", fontSize: "0.9rem" }}
                >
                  {availableRemolques.map((v) => (
                    <option key={v.id_vehiculos} value={v.id_vehiculos}>
                      {v.numero_economico} - {v.nombre} ({v.placas || "Sin placas"}) {v.marca ? `| ${v.marca}` : ""}
                    </option>
                  ))}
                </select>
                {remolquesCatalog.length === 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#d97706", marginTop: "6px", display: "block" }}>
                    ⚠️ No se encontraron unidades con "Remolque" en su descripción. Se listan todas las unidades disponibles.
                  </span>
                )}
              </div>

              {selectedTrailerObj?.id_vehiculos && (
                <div className="inspection-data-grid" style={{ marginBottom: 0 }}>
                  <p><strong>Económico:</strong> {selectedTrailerObj.numero_economico || "Sin registro"}</p>
                  <p><strong>Nombre / Tipo:</strong> {selectedTrailerObj.nombre || selectedTrailerObj.tipo_vehiculo || "Remolque"}</p>
                  <p><strong>Placas:</strong> {selectedTrailerObj.placas || "Sin placas"}</p>
                  <p><strong>Marca / Modelo:</strong> {selectedTrailerObj.marca || "N/A"} {selectedTrailerObj.modelo || ""}</p>
                  <p><strong>N° Serie:</strong> {selectedTrailerObj.numero_serie || "Sin registro"}</p>
                  <p><strong>Póliza Seguro:</strong> {selectedTrailerObj.numero_poliza || "Sin registro"}</p>
                </div>
              )}

              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px", fontSize: "0.82rem", color: "#1e40af" }}>
                💡 <strong>Siguiente paso:</strong> Presiona <strong>Siguiente</strong> para registrar daños en las 4 vistas del diagrama del remolque y llenar su checklist de control.
              </div>
            </div>
          )}

          {/* PASOS 2 A 5: Vistas del Diagrama de Daños */}
          {currentView && (() => {
            const [key, label, image] = currentView;
            const points = danos[key] || [];

            return (
              <div className="inspection-visual">
                <div className="inspection-section-heading">
                  <div>
                    <h3>{label}</h3>
                    <p>Toca el diagrama para encerrar un daño. El círculo rojo confirma el punto marcado.</p>
                  </div>
                  <button
                    type="button"
                    className="inspection-secondary-button"
                    onClick={() => clearView(key)}
                    disabled={!points.length}
                  >
                    Limpiar vista
                  </button>
                </div>

                <div className={`damage-map damage-map-${key}`}>
                  <div
                    className="damage-stage"
                    onPointerDown={(event) => markDamage(key, event)}
                    role="application"
                    aria-label={`${label}. Toca para marcar daños`}
                  >
                    <img src={image} alt={`Diagrama de ${label}`} />
                    {points.map((point, index) => (
                      <button
                        key={`${point.x}-${point.y}-${index}`}
                        type="button"
                        className="damage-point"
                        style={{ left: `${point.x}%`, top: `${point.y}%` }}
                        onPointerDown={(event) => removePoint(key, index, event)}
                        aria-label={`Eliminar marca ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <p className="damage-feedback" role="status" aria-live="polite">
                  {lastMarked || (points.length > 0 ? `Se han marcado ${points.length} daño(s) en esta vista.` : "Aún no has marcado daños en esta vista.")}
                </p>
              </div>
            );
          })()}

          {/* PASO 6: Checklist de Control */}
          {step === 5 && (
            <div className="inspection-checklist">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3>Checklist de control del remolque</h3>
                  <p>Desliza la barra para evaluar el estado de cada componente:</p>
                </div>
                <button
                  type="button"
                  onClick={markAllChecklistAsGood}
                  style={{
                    background: "#22c55e",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    cursor: "pointer"
                  }}
                >
                  🟢 Marcar todo como Bueno (B)
                </button>
              </div>

              {/* Leyenda de colores superior */}
              <div className="checklist-legend-header">
                <div className="legend-item legend-state-0">
                  <span className="legend-color-dot"></span>
                  <strong>0:</strong> N/A
                </div>
                <div className="legend-item legend-state-1">
                  <span className="legend-color-dot"></span>
                  <strong>1:</strong> Malo
                </div>
                <div className="legend-item legend-state-2">
                  <span className="legend-color-dot"></span>
                  <strong>2:</strong> Regular
                </div>
                <div className="legend-item legend-state-3">
                  <span className="legend-color-dot"></span>
                  <strong>3:</strong> Bueno
                </div>
              </div>

              {Object.entries(REMOLQUE_CHECKLIST_GROUPS).map(([group, items]) => (
                <fieldset key={group}>
                  <legend>{group}</legend>
                  {items.map((item) => {
                    const currentState = checklist[item] || "B";
                    const currentNum = STATE_TO_NUM[currentState] ?? 3;
                    return (
                      <div className="check-row-slider" key={item}>
                        <span className="check-label">{item}</span>
                        <div className="slider-control-group">
                          <input
                            type="range"
                            min="0"
                            max="3"
                            step="1"
                            value={currentNum}
                            onChange={(event) => chooseChecklist(item, NUM_TO_STATE[Number(event.target.value)])}
                            className={`checklist-volume-slider slider-state-${currentNum}`}
                            aria-label={`Estado de ${item}`}
                          />
                          <span className={`checklist-slider-badge slider-badge-${currentNum}`}>
                            {currentState}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}

          {/* PASO 7: Observaciones y Resumen Final */}
          {step === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: "#173f51" }}>
                  Observaciones y Resumen de Inspección
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#607986" }}>
                  Verifica el resumen de los datos capturados e ingresa comentarios adicionales antes de guardar.
                </p>
              </div>

              {/* Resumen de daños en vistas */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px" }}>
                <strong style={{ fontSize: "0.85rem", color: "#1e293b", display: "block", marginBottom: "8px" }}>
                  🎨 Marcas de daño registradas: {totalDamagesCount > 0 ? `(${totalDamagesCount} total)` : "(Sin daños marcados)"}
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", fontSize: "0.8rem" }}>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: "6px" }}>
                    Frontal: <strong>{(danos.frontal || []).length}</strong> marca(s)
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: "6px" }}>
                    Lateral Derecha: <strong>{(danos.derecha || []).length}</strong> marca(s)
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: "6px" }}>
                    Trasera: <strong>{(danos.trasera || []).length}</strong> marca(s)
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: "6px" }}>
                    Lateral Izquierda: <strong>{(danos.izquierda || []).length}</strong> marca(s)
                  </div>
                </div>
              </div>

              {/* Resumen de checklist */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px" }}>
                <strong style={{ fontSize: "0.85rem", color: "#1e293b", display: "block", marginBottom: "8px" }}>
                  📋 Resumen de evaluación checklist ({allChecklistItems.length} puntos):
                </strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.78rem" }}>
                  <span className="checklist-badge checklist-badge-good">🟢 Bueno (B): {goodCount}</span>
                  <span className="checklist-badge checklist-badge-regular">🟡 Regular (R): {regularCount}</span>
                  <span className="checklist-badge checklist-badge-bad">🔴 Malo (M): {badCount}</span>
                  <span className="checklist-badge checklist-badge-na">⚪ N/A: {naCount}</span>
                </div>
              </div>

              {/* Observaciones textarea */}
              <label className="inspection-textarea-label">
                Comentarios / Observaciones del remolque
                <textarea
                  rows="5"
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  placeholder="Describe observaciones, faltantes, amortiguación, llantas o detalles de daños en el remolque..."
                />
              </label>
            </div>
          )}

        </div>

        {/* Botones de navegación del Wizard */}
        <footer className="inspection-actions">
          <button
            type="button"
            className="inspection-secondary-button"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            Anterior
          </button>
          {step < totalSteps - 1 ? (
            <button
              type="button"
              className="inspection-primary-button"
              disabled={!canContinue()}
              onClick={() => setStep((current) => current + 1)}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              className="inspection-primary-button"
              disabled={!canContinue()}
              onClick={handleSave}
            >
              Guardar Inspección de Remolque
            </button>
          )}
        </footer>

      </div>
    </div>,
    document.body
  );
}
