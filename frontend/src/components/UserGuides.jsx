import { useEffect, useRef, useState } from 'react';
import TripOperationModal from './TripOperationModal.jsx';
import { IconUsers, IconCar, IconMap } from './Icons.jsx';
import { userGuides, GUIDE_VERSION } from './user-guides.js';
import safeStorage from '../utils/safeStorage.js';
import './TripOperations.css';
import './UserGuides.css';

export default function UserGuides({ driverId, autoOpen = false, showEntry = false }) {
 const key=`gv_guides_seen:${driverId}:${GUIDE_VERSION}`;
 const [open,setOpen]=useState(false),[topic,setTopic]=useState(0),[step,setStep]=useState(0),[expanded,setExpanded]=useState(false);
 const seen=useRef(false),touch=useRef(null);
 useEffect(()=>{ if(driverId && autoOpen && !seen.current && !safeStorage.getItem(key)){ seen.current=true;setOpen(true); } },[driverId,autoOpen,key]);
 const guide=userGuides[topic],slide=guide.steps[step];
 const close=()=>{safeStorage.setItem(key,'1');seen.current=true;setOpen(false);setExpanded(false);};
 const move=next=>{setStep(next);setExpanded(false);};
 const choose=index=>{setTopic(index);setStep(0);setExpanded(false);setOpen(true);};
 return <>
  {showEntry && <section className="user-guides-entry" aria-labelledby="guides-heading">
    <h2 id="guides-heading">Guías visuales</h2><p>Aprende con capturas de la app, paso a paso.</p>
    <div>{userGuides.map((g,i)=>{const Icon=[IconUsers,IconCar,IconMap][i];return <button key={g.id} type="button" onClick={()=>choose(i)}><Icon size={22}/><span>{g.label}</span><small>{g.steps.length} pasos →</small></button>})}</div>
  </section>}
  {open && <TripOperationModal headerCaption="PASO A PASO" title="Guías de la app" icon={<IconMap size={22}/>} onClose={close}
    footer={<div className="user-guides-footer"><span aria-live="polite">{step+1} de {guide.steps.length}</span><div>
      <button type="button" className="trip-operation-done-btn" disabled={step===0} onClick={()=>move(step-1)}>Atrás</button>
      <button type="button" className="trip-ops-primary" onClick={()=>step<guide.steps.length-1?move(step+1):topic<userGuides.length-1?choose(topic+1):close()}>{step<guide.steps.length-1?'Siguiente':topic<userGuides.length-1?'Otra guía':'Entendido'}</button>
    </div></div>}>
    <div className="visual-guide">
      <div className="user-guide-topics" aria-label="Temas de las guías">{userGuides.map((g,i)=><button type="button" aria-pressed={topic===i} key={g.id} onClick={()=>choose(i)}>{g.label}</button>)}</div>
      <div className="user-guide-copy" aria-live="polite"><h3>{slide.title}</h3><p>{slide.text}</p></div>
      <button type="button" className={`user-guide-image ${expanded?'expanded':''}`} aria-label={expanded?'Reducir captura':'Ampliar captura'} aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}
        onTouchStart={e=>{touch.current=e.touches[0].clientX;}}
        onTouchEnd={e=>{const delta=(touch.current??e.changedTouches[0].clientX)-e.changedTouches[0].clientX;touch.current=null;if(Math.abs(delta)>60){if(delta>0&&step<guide.steps.length-1)move(step+1);else if(delta<0&&step>0)move(step-1);}}}>
        <img src={slide.image} alt={slide.alt} width="390" height="844"/><span>{expanded?'Reducir imagen':'Toca para ampliar'}</span>
      </button>
      <div className="user-guide-dots" aria-label="Pasos">{guide.steps.map((s,i)=><button key={s.title} type="button" aria-label={`Paso ${i+1}: ${s.title}`} aria-current={step===i?'step':undefined} onClick={()=>move(i)}/>)}</div>
      <small className="user-guide-note">Capturas reales de la interfaz con datos de demostración.</small>
    </div>
  </TripOperationModal>}
 </>;
}
