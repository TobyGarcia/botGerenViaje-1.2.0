import {useEffect,useRef,useId} from 'react';
import {createPortal} from 'react-dom';
import {IconCheck,IconAlerta,IconCross} from './Icons.jsx';
import {useModalBack} from '../hooks/useModalBack.js';
import './AppFeedbackModal.css';
export default function AppFeedbackModal({message,title='Aviso',type='info',onClose,onAction,actionLabel='Reintentar',busy=false}){
 const heading=useId();const dialog=useRef(null);useModalBack(Boolean(message),onClose,false,100);
 useEffect(()=>{if(!message)return;const opener=document.activeElement;dialog.current?.showModal();return()=>{dialog.current?.close();opener?.focus?.();};},[Boolean(message)]);
 if(!message)return null;
 return createPortal(<dialog ref={dialog} className="app-feedback-modal" aria-labelledby={heading} onKeyDown={event=>{if(event.key==='Escape')event.stopPropagation();}} onCancel={event=>{event.preventDefault();onClose();}}>
  <header><span className="app-feedback-icon" data-type={type}>{type==='success'?<IconCheck size={23}/>:<IconAlerta size={23}/>}</span><h2 id={heading}>{title}</h2><button className="app-feedback-close" aria-label="Cerrar aviso" type="button" onClick={onClose}><IconCross size={19}/></button></header>
  <div className="app-feedback-body"><p>{message}</p></div>
  <footer>{onAction&&<button type="button" onClick={onClose}>Ahora no</button>}<button type="button" disabled={busy} onClick={onAction||onClose}>{busy?'Procesando…':onAction?actionLabel:'Entendido'}</button></footer>
 </dialog>,document.body);
}
