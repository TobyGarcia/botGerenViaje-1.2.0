import { useEffect, useRef, useState } from "react";
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

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = 180 * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#173f51";
  }, []);
  function position(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function start(event) {
    drawingRef.current = true;
    const point = position(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!drawingRef.current) return;
    const point = position(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(point.x, point.y); ctx.stroke();
  }
  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }
  return <div className="signature-pad"><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /><button type="button" onClick={clear}>Limpiar firma</button></div>;
}

export default function InspeccionVehicular({ context, estado, onSubmit, saving }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ combustible: "", tipoAsignacion: "PERMANENTE", asignacionInicio: "", asignacionFin: "", danos: {}, checklist: {}, observaciones: "", firma: "" });
  const totalSteps = 8;
  if (estado === "PENDIENTE_APROBACION") return <section className="inspection-card"><h2>Inspección enviada</h2><p>La unidad está esperando aprobación administrativa. La campana del panel ya muestra la solicitud.</p></section>;

  function markDamage(view, event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: Number((((event.clientX - rect.left) / rect.width) * 100).toFixed(2)), y: Number((((event.clientY - rect.top) / rect.height) * 100).toFixed(2)) };
    setForm((current) => ({ ...current, danos: { ...current.danos, [view]: [...(current.danos[view] || []), point] } }));
  }
  function canContinue() {
    if (step === 0) return form.combustible && form.tipoAsignacion && (form.tipoAsignacion !== "TEMPORAL" || (form.asignacionInicio && form.asignacionFin));
    if (step === 5) return Object.values(checklistGroups).flat().every((item) => form.checklist[item]);
    if (step === 7) return Boolean(form.firma);
    return true;
  }
  return <section className="inspection-card">
    <header><span>Inspección vehicular diaria</span><h2>Paso {step + 1} de {totalSteps}</h2><progress value={step + 1} max={totalSteps} /></header>
    {step === 0 && <div className="inspection-cover"><h3>Datos de la unidad</h3><div className="inspection-data-grid">
      <p><strong>Folio:</strong> {context.folio}</p><p><strong>Unidad:</strong> {context.numero_economico}</p><p><strong>Vehículo:</strong> {context.marca} {context.modelo}</p><p><strong>Tipo:</strong> {context.tipo_vehiculo || "Sin registro"}</p><p><strong>Conductor:</strong> {context.conductor}</p><p><strong>Licencia:</strong> {context.licencia_numero || "Sin registro"}</p><p><strong>Tipo licencia:</strong> {context.tipo_licencia || "Sin registro"}</p><p><strong>Serie:</strong> {context.numero_serie || "Sin registro"}</p><p><strong>Póliza:</strong> {context.numero_poliza || "Sin registro"}</p><p><strong>Vencimiento:</strong> {context.seguro_vencimiento || "Sin registro"}</p><p><strong>Placas:</strong> {context.placas}</p><p><strong>Kilometraje:</strong> {context.kilometraje_actual} km</p>
    </div><label>Nivel de combustible<select value={form.combustible} onChange={(e) => setForm({...form, combustible:e.target.value})}><option value="">Selecciona</option>{["E","1/4","1/2","3/4","F"].map(v=><option key={v}>{v}</option>)}</select></label><label>Asignación<select value={form.tipoAsignacion} onChange={(e)=>setForm({...form,tipoAsignacion:e.target.value,asignacionInicio:"",asignacionFin:""})}><option value="PERMANENTE">Permanente</option><option value="TEMPORAL">Temporal</option></select></label>{form.tipoAsignacion === "TEMPORAL" && <div className="date-range"><label>Inicio<input type="date" value={form.asignacionInicio} onChange={(e)=>setForm({...form,asignacionInicio:e.target.value})}/></label><label>Fin<input type="date" value={form.asignacionFin} onChange={(e)=>setForm({...form,asignacionFin:e.target.value})}/></label></div>}</div>}
    {step >= 1 && step <= 4 && (() => { const [key,label,image] = views[step-1]; return <div><h3>{label}</h3><p>Toca la imagen para marcar daños. Toca un punto para retirarlo.</p><div className="damage-map" onClick={(e)=>markDamage(key,e)}><img src={image} alt={label}/>{(form.danos[key]||[]).map((p,index)=><button type="button" key={`${p.x}-${p.y}-${index}`} className="damage-point" style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={(e)=>{e.stopPropagation();setForm(c=>({...c,danos:{...c.danos,[key]:c.danos[key].filter((_,i)=>i!==index)}}));}} aria-label="Quitar marca"/>)}</div></div>; })()}
    {step === 5 && <div className="inspection-checklist">{Object.entries(checklistGroups).map(([group,items])=><fieldset key={group}><legend>{group}</legend>{items.map(item=><div className="check-row" key={item}><span>{item}</span>{["B","R","M","N/A"].map(value=><label key={value}><input type="radio" name={item} value={value} checked={form.checklist[item]===value} onChange={()=>setForm(c=>({...c,checklist:{...c.checklist,[item]:value}}))}/>{value}</label>)}</div>)}</fieldset>)}</div>}
    {step === 6 && <label>Comentarios del conductor<textarea rows="7" value={form.observaciones} onChange={(e)=>setForm({...form,observaciones:e.target.value})} placeholder="Describe daños, faltantes o condiciones relevantes"/></label>}
    {step === 7 && <div><h3>Firma del conductor</h3><p>Firma dentro del recuadro para enviar la inspección.</p><SignaturePad onChange={(firma)=>setForm(c=>({...c,firma}))}/></div>}
    <footer className="inspection-actions"><button type="button" disabled={step===0 || saving} onClick={()=>setStep(step-1)}>Anterior</button>{step < totalSteps-1 ? <button type="button" disabled={!canContinue()} onClick={()=>setStep(step+1)}>Siguiente</button> : <button type="button" disabled={!canContinue() || saving} onClick={()=>onSubmit(form)}>{saving ? "Enviando..." : "Enviar a aprobación"}</button>}</footer>
  </section>;
}
