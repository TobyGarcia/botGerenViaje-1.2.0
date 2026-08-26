import { useEffect, useRef, useState } from "react";
import { decidirSupervisorInspeccion, getSupervisorInspeccion, getSupervisorInspecciones, ingresarCorreoSupervisor } from "../services/api.js";
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
  const [items, setItems] = useState([]); const [detail, setDetail] = useState(null); const [message,setMessage]=useState(""); const [signature,setSignature]=useState(""); const [comment,setComment]=useState("");
  
  async function load() { try { setItems((await getSupervisorInspecciones()).data); } catch(error) { setMessage(error.message); } }
  useEffect(()=>{ if (access.confirmed) load(); }, [access.confirmed]);
  
  async function submitTenantEmail(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await ingresarCorreoSupervisor(tenantEmail.trim());
      setMessage(result.message);
      await onAccessChanged();
    } catch(error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function open(id) { try { setDetail((await getSupervisorInspeccion(id)).data); setSignature(""); } catch(error) { setMessage(error.message); } }
  async function decide(aprobada) { try { const result=await decidirSupervisorInspeccion(detail.id_inspeccion,{aprobada,comentario:comment,firma:signature}); setMessage(result.message); setDetail(null); load(); } catch(error) { setMessage(error.message); } }
  
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

      {message && <p className="message message-error" style={{ marginTop: "16px" }}>{message}</p>}
    </main>
  );

  if (!access.confirmed) return <main className="container"><h1>Confirma tu correo</h1><p>Te enviamos un enlace de bienvenida. Ábrelo y vuelve a entrar desde Telegram para activar las aprobaciones.</p>{message&&<p>{message}</p>}</main>;
  return <main className="container"><h1>Inspecciones pendientes</h1>{message&&<p className="message message-success">{message}</p>}{!detail ? <section>{items.length ? items.map(item=><button type="button" key={item.id_inspeccion} className="result-card" onClick={()=>open(item.id_inspeccion)}><strong>{item.folio}</strong><br/>{item.conductor} · {item.vehiculo} ({item.numero_economico})</button>) : <p>No hay inspecciones pendientes.</p>}</section> : <section className="result-card"><button type="button" onClick={()=>setDetail(null)}>← Volver</button><h2>{detail.folio}</h2><p><strong>Conductor:</strong> {detail.conductor}</p><p><strong>Unidad:</strong> {detail.vehiculo} · {detail.numero_economico}</p><p><strong>Combustible:</strong> {detail.combustible}</p><p><strong>Observaciones:</strong> {detail.observaciones_conductor||"Sin observaciones"}</p><DamageViewer damages={detail.danos} vehicle={detail.vehiculo}/><h3>Checklist</h3><div className="table-wrapper checklist-table-wrapper"><table className="admin-table checklist-table"><thead><tr><th>Actividad</th><th style={{ width: "90px", textAlign: "center" }}>Estado</th></tr></thead><tbody>{Object.entries(detail.checklist||{}).map(([name,state])=><tr key={name}><td>{name}</td><td style={{ textAlign: "center" }}><span className={`checklist-badge checklist-badge-${state==="B"?"good":state==="R"?"regular":state==="M"?"bad":"na"}`}>{state}</span></td></tr>)}</tbody></table></div><label>Comentario<textarea value={comment} onChange={e=>setComment(e.target.value)}/></label>{signature ? <p>Firma guardada.</p> : <Signature onSave={setSignature}/>}<button type="button" disabled={!signature} onClick={()=>decide(false)}>Rechazar</button><button type="button" disabled={!signature} onClick={()=>decide(true)}>Aprobar y generar PDF</button></section>}</main>;
}
