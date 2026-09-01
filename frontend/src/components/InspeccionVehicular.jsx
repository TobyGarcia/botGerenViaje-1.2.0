import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import conductorImage from "../assets/conductor.png";
import frontalImage from "../assets/frontal.png";
import pasajeroImage from "../assets/pasajero.png";
import traseraImage from "../assets/trasera.png";

const views = [
  ["frontal", "Vista frontal", frontalImage],
  ["trasera", "Vista trasera", traseraImage],
  ["conductor", "Lateral conductor", conductorImage],
  ["pasajero", "Lateral pasajero", pasajeroImage]
];

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

const checklistStates = ["B", "R", "M", "N/A"];
const STATE_TO_NUM = { "N/A": 0, "M": 1, "R": 2, "B": 3 };
const NUM_TO_STATE = { 0: "N/A", 1: "M", 2: "R", 3: "B" };

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const configureCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.8;
      context.strokeStyle = "#173f51";
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
    const context = canvas.getContext("2d");
    const point = pointFor(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    canvas.setPointerCapture?.(event.pointerId);
    setHasInk(true);
  }

  function drawStroke(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = pointFor(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endStroke(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function save() {
    if (!hasInk) return;
    onSave(canvasRef.current.toDataURL("image/png"));
  }

  return createPortal(
    <div className="signature-dialog" role="dialog" aria-modal="true" aria-labelledby="signature-title">
      <div className="signature-dialog-card">
        <div className="signature-dialog-heading">
          <div>
            <span>Confirmación</span>
            <h3 id="signature-title">Firma del conductor</h3>
            <p>Firma dentro del recuadro y guarda cuando termines.</p>
          </div>
          <button type="button" className="inspection-icon-button" onClick={onCancel} aria-label="Cancelar firma">×</button>
        </div>
        <div className="signature-canvas-area">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            aria-label="Área para firmar"
            onPointerDown={beginStroke}
            onPointerMove={drawStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
        <div className="signature-dialog-actions">
          <button type="button" className="inspection-secondary-button" onClick={clear}>Limpiar firma</button>
          <button type="button" className="inspection-primary-button" disabled={!hasInk} onClick={save}>Guardar firma</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function InspeccionVehicular({ context, estado, onSubmit, saving, onClose }) {
  const [step, setStep] = useState(0);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [lastMarked, setLastMarked] = useState("");
  const [tirePressures, setTirePressures] = useState({ di: "32", dd: "32", ti: "35", td: "35" });
  const [form, setForm] = useState({ combustible: "", tipoAsignacion: "PERMANENTE", asignacionInicio: "", asignacionFin: "", danos: {}, checklist: {}, observaciones: "", firma: "", esDiaSiguiente: false });
  const totalSteps = 8;
  const currentView = step >= 1 && step <= 4 ? views[step - 1] : null;

  function updateForm(changes) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function saveSignature(firma) {
    if (!firma || !firma.startsWith("data:image/png;base64,")) return;
    setForm((current) => ({ ...current, firma }));
    setSignatureOpen(false);
  }

  function markDamage(view, event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const point = {
      x: Number((Math.max(0, Math.min(rect.width, event.clientX - rect.left)) / rect.width * 100).toFixed(2)),
      y: Number((Math.max(0, Math.min(rect.height, event.clientY - rect.top)) / rect.height * 100).toFixed(2))
    };
    setForm((current) => ({ ...current, danos: { ...current.danos, [view]: [...(current.danos[view] || []), point] } }));
    setLastMarked("Marca agregada. Toca el círculo rojo para eliminarlo.");
  }

  function clearView(view) {
    setForm((current) => ({ ...current, danos: { ...current.danos, [view]: [] } }));
    setLastMarked("Se limpiaron las marcas de esta vista.");
  }

  function chooseChecklist(item, value) {
    setForm((current) => ({ ...current, checklist: { ...current.checklist, [item]: value } }));
  }

  function updateTirePressure(tireKey, value) {
    const updated = { ...tirePressures, [tireKey]: value };
    setTirePressures(updated);
  }

  function canContinue() {
    if (step === 0) return form.combustible && form.tipoAsignacion && (form.tipoAsignacion !== "TEMPORAL" || (form.asignacionInicio && form.asignacionFin));
    if (step === 5) return Object.values(checklistGroups).flat().every((item) => (form.checklist[item] || "B"));
    if (step === 7) return Boolean(form.firma);
    return true;
  }

  if (estado === "PENDIENTE_APROBACION") return <section className="inspection-card inspection-complete"><h2>Inspección enviada</h2><p>La unidad está esperando aprobación administrativa. Puedes cerrar esta ventana y consultar el estado desde el viaje.</p><button type="button" className="inspection-primary-button" onClick={onClose}>Cerrar</button></section>;

  return <section className="inspection-card">
    <header className="inspection-header"><div><span>Inspección vehicular diaria</span><h2>Paso {step + 1} de {totalSteps}</h2></div><button type="button" className="inspection-icon-button" onClick={onClose} aria-label="Cerrar inspección">×</button><progress value={step + 1} max={totalSteps} /></header>
    {step === 0 && <div className="inspection-cover"><h3>Datos de la unidad asignada</h3><div className="inspection-data-grid">
      <p><strong>Folio:</strong> {context.folio}</p><p><strong>Unidad asignada:</strong> {context.numero_economico}</p><p><strong>Vehículo:</strong> {context.marca} {context.modelo}</p><p><strong>Tipo:</strong> {context.tipo_vehiculo || "Sin registro"}</p><p><strong>Conductor:</strong> {context.conductor}</p><p><strong>Licencia:</strong> {context.licencia_numero || "Sin registro"}</p><p><strong>Tipo licencia:</strong> {context.tipo_licencia || "Sin registro"}</p><p><strong>Serie:</strong> {context.numero_serie || "Sin registro"}</p><p><strong>Póliza:</strong> {context.numero_poliza || "Sin registro"}</p><p><strong>Vencimiento:</strong> {context.seguro_vencimiento || "Sin registro"}</p><p><strong>Placas:</strong> {context.placas}</p><p><strong>Kilometraje:</strong> {context.kilometraje_actual} km</p>
    </div><div className="inspection-field-grid">
      <label className="checkbox-label" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: form.esDiaSiguiente ? "#eff6ff" : "#f8fafc", borderRadius: "8px", border: form.esDiaSiguiente ? "1px solid #3b82f6" : "1px solid #cbd5e1", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={form.esDiaSiguiente}
          onChange={(event) => updateForm({ esDiaSiguiente: event.target.checked })}
          style={{ width: "20px", height: "20px", cursor: "pointer" }}
        />
        <div>
          <strong style={{ color: form.esDiaSiguiente ? "#1d4ed8" : "#1e293b", fontSize: "0.95rem" }}>
            🌙 Inspección para el Día Siguiente (Salida 4:00 AM - 7:00 AM)
          </strong>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            Marca esta casilla si realizas la inspección con anticipación para poder salir temprano en tu unidad asignada.
          </p>
        </div>
      </label>
      <label>Nivel de combustible<select value={form.combustible} onChange={(event) => updateForm({ combustible: event.target.value })}><option value="">Selecciona</option>{["E", "1/4", "1/2", "3/4", "F"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Asignación<select value={form.tipoAsignacion} onChange={(event) => updateForm({ tipoAsignacion: event.target.value, asignacionInicio: "", asignacionFin: "" })}><option value="PERMANENTE">Permanente</option><option value="TEMPORAL">Temporal</option></select></label></div>{form.tipoAsignacion === "TEMPORAL" && <div className="date-range"><label>Inicio<input type="date" value={form.asignacionInicio} onChange={(event) => updateForm({ asignacionInicio: event.target.value })} /></label><label>Fin<input type="date" value={form.asignacionFin} onChange={(event) => updateForm({ asignacionFin: event.target.value })} /></label></div>}</div>}
    {currentView && (() => { const [key, label, image] = currentView; const points = form.danos[key] || []; const removePoint = (index, event) => { event.preventDefault(); event.stopPropagation(); setForm((current) => ({ ...current, danos: { ...current.danos, [key]: current.danos[key].filter((_, pointIndex) => pointIndex !== index) } })); setLastMarked("Marca eliminada."); }; return <div className="inspection-visual"><div className="inspection-section-heading"><div><h3>{label}</h3><p>Toca el diagrama para encerrar un daño. El círculo rojo confirma el punto marcado.</p></div><button type="button" className="inspection-secondary-button" onClick={() => clearView(key)} disabled={!points.length}>Limpiar vista</button></div><div className={`damage-map damage-map-${key}`}><div className="damage-stage" onPointerDown={(event) => markDamage(key, event)} role="application" aria-label={`${label}. Toca para marcar daños`}><img src={image} alt={`Diagrama de ${label}`} />{points.map((point, index) => <button key={`${point.x}-${point.y}-${index}`} type="button" className="damage-point" style={{ left: `${point.x}%`, top: `${point.y}%` }} onPointerDown={(event) => removePoint(index, event)} aria-label={`Eliminar marca ${index + 1}`} />)}</div></div><p className="damage-feedback" role="status" aria-live="polite">{lastMarked || "Aún no has marcado daños en esta vista."}</p></div>; })()}
    {step === 5 && <div className="inspection-checklist">
      <div>
        <h3>Checklist de la unidad</h3>
        <p>Desliza la barra para seleccionar el estado de cada punto:</p>
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

      {Object.entries(checklistGroups).map(([group, items]) => <fieldset key={group}>
        <legend>{group}</legend>

        {group === "Condiciones generales" && (
          <div className="tire-pressures-card">
            <div className="tire-pressures-header">
              <span>🚘 Presión de las 4 llantas (PSI)</span>
            </div>
            <div className="tire-pressures-grid">
              <label className="tire-field">
                <small>Delantera Izq.</small>
                <input
                  type="text"
                  placeholder="32 PSI"
                  value={tirePressures.di}
                  onChange={(e) => updateTirePressure("di", e.target.value)}
                />
              </label>
              <label className="tire-field">
                <small>Delantera Der.</small>
                <input
                  type="text"
                  placeholder="32 PSI"
                  value={tirePressures.dd}
                  onChange={(e) => updateTirePressure("dd", e.target.value)}
                />
              </label>
              <label className="tire-field">
                <small>Trasera Izq.</small>
                <input
                  type="text"
                  placeholder="35 PSI"
                  value={tirePressures.ti}
                  onChange={(e) => updateTirePressure("ti", e.target.value)}
                />
              </label>
              <label className="tire-field">
                <small>Trasera Der.</small>
                <input
                  type="text"
                  placeholder="35 PSI"
                  value={tirePressures.td}
                  onChange={(e) => updateTirePressure("td", e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        {items.map((item) => {
          const currentState = form.checklist[item] || "B";
          const currentNum = STATE_TO_NUM[currentState] ?? 3;
          return <div className="check-row-slider" key={item}>
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
          </div>;
        })}
      </fieldset>)}
    </div>}
    {step === 6 && <label className="inspection-textarea-label">Comentarios del conductor<textarea rows="7" value={form.observaciones} onChange={(event) => updateForm({ observaciones: event.target.value })} placeholder="Describe daños, faltantes o condiciones relevantes" /></label>}
    {step === 7 && <div className="inspection-signature"><h3>Firma del conductor</h3><p>Abre la ventana de firma, firma y guarda para habilitar el envío.</p>{form.firma ? <div className="signature-saved"><img src={form.firma} alt="Firma capturada del conductor" /><span>Firma guardada</span></div> : <p className="signature-pending">Firma pendiente</p>}<button type="button" className="inspection-primary-button" onClick={() => setSignatureOpen(true)}>{form.firma ? "Cambiar firma" : "Abrir ventana de firma"}</button></div>}
    <footer className="inspection-actions"><button type="button" className="inspection-secondary-button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Anterior</button>{step < totalSteps - 1 ? <button type="button" className="inspection-primary-button" disabled={!canContinue()} onClick={() => setStep((current) => current + 1)}>Siguiente</button> : <button type="button" className="inspection-primary-button" disabled={!canContinue() || saving} onClick={() => {
      const finalForm = { ...form };
      // Garantizar que todos los ítems no seleccionados explícitamente se guarden como "B" (Bueno)
      Object.values(checklistGroups).flat().forEach((item) => {
        if (!finalForm.checklist[item]) finalForm.checklist[item] = "B";
      });
      // Incluir resumen de presión de 4 llantas
      finalForm.checklist["Presión de neumáticos"] = `${finalForm.checklist["Presión de neumáticos"] || "B"} (DI:${tirePressures.di}, DD:${tirePressures.dd}, TI:${tirePressures.ti}, TD:${tirePressures.td} PSI)`;
      onSubmit(finalForm);
    }}>{saving ? "Enviando..." : "Enviar a aprobación"}</button>}</footer>
    {signatureOpen && <SignaturePad onCancel={() => setSignatureOpen(false)} onSave={saveSignature} />}
  </section>;
}
