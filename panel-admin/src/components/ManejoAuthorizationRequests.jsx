import AppFeedbackModal from './AppFeedbackModal.jsx';
import {useModalBack} from '../hooks/useModalBack.js';
import {useCallback,useEffect,useRef,useState} from 'react';
import {getManejoAuthorizationRequests,decideManejoAuthorizationRequest} from '../services/api.js';
import {useApprovalLiveRefresh} from '../hooks/useApprovalLiveRefresh.js';
import {refreshApproverNotifications} from './SupervisorNotifications.jsx';
import {IconShield,IconCross} from './Icons.jsx';
import './ManejoAuthorizationRequests.css';

export default function ManejoAuthorizationRequests({Signature}){
 const[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[signature,setSignature]=useState(''),[comment,setComment]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
 useModalBack(Boolean(selected),()=>setSelected(null),saving);
 const selectedRef=useRef(selected);selectedRef.current=selected;
 const load=useCallback(async({signal,background=false}={})=>{
  try{const result=await getManejoAuthorizationRequests({signal});if(signal?.aborted)return;setRows(result.data||[]);
   if(selectedRef.current&&!result.data?.some(r=>String(r.id_autorizacion)===String(selectedRef.current.id_autorizacion))){setSelected(null);setMessage('La solicitud fue atendida o retirada.');}
  }catch(error){if(!signal?.aborted&&!background)setMessage(error.message);}finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load({signal:controller.signal});return()=>controller.abort();},[load]);
 useApprovalLiveRefresh(load,!saving&&!loading);
 async function decide(approved){
  if(!signature||saving)return;setSaving(true);setMessage('');
  try{const result=await decideManejoAuthorizationRequest(selected.id_autorizacion,{aprobada:approved,comentario:comment,firma:signature});setSelected(null);setMessage(result.message);await Promise.all([load(),refreshApproverNotifications()]);}
  catch(error){setMessage(error.message);await load({background:true});}finally{setSaving(false);}
 }
 if(loading||(!rows.length&&!message))return null;
 return <section className="manejo-requests" aria-label="Autorizaciones de manejo comentado">
  {message&&<AppFeedbackModal message={message} onClose={()=>setMessage('')}/>}
  {rows.length>0&&<details><summary><IconShield size={20}/><span>Manejo comentado</span><strong>{rows.length} por autorizar</strong></summary>
   <div className="manejo-request-list">{rows.map(row=><article key={row.id_autorizacion}>
    <strong>{row.folio}</strong><p>{row.conductor}</p><small>{row.vehiculo} · {row.numero_economico}</small>
    <p>{row.origen||'Sin origen'} → {row.destino||'Sin destino'}</p>
    <small>Manejo comentado vencido o no registrado</small>
    <button type="button" onClick={()=>{setSelected(row);setSignature('');setComment('');setMessage('');}}>Revisar solicitud</button>
   </article>)}</div>
  </details>}
  {selected&&<div className="manejo-review-overlay" onClick={()=>{if(!saving)setSelected(null);}}>
   <section className="manejo-review" role="dialog" aria-modal="true" aria-labelledby="manejo-review-title" onClick={e=>e.stopPropagation()}>
    <header><IconShield size={24}/><h2 id="manejo-review-title">Autorizar inicio de viaje</h2><button type="button" aria-label="Cerrar autorización" disabled={saving} onClick={()=>setSelected(null)}><IconCross size={20}/></button></header>
    <div className="manejo-review-body"><strong>{selected.folio}</strong><p>{selected.conductor}</p><p>{selected.vehiculo} · {selected.numero_economico}</p><p>{selected.origen} → {selected.destino}</p>
     <p className="manejo-review-warning">El manejo comentado está vencido o no registrado. Esta autorización aplica solo a este viaje.</p>
     <label>Comentario<textarea value={comment} disabled={saving} onChange={e=>setComment(e.target.value)} maxLength={1000}/></label>
     <fieldset disabled={saving}><Signature onChange={setSignature}/></fieldset>

    </div>
    <footer><button type="button" disabled={saving||!signature} onClick={()=>void decide(false)}>Rechazar</button><button type="button" disabled={saving||!signature} onClick={()=>void decide(true)}>{saving?'Guardando…':'Autorizar inicio'}</button></footer>
   </section>
  </div>}
 </section>;
}
