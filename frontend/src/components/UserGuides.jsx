import { useEffect, useRef, useState } from 'react';
import TripOperationModal from './TripOperationModal.jsx';
import { IconUsers, IconInfo, IconSparkles } from './Icons.jsx';
import TripTrailerIcon from './TripTrailerIcon.jsx';
import { userGuides } from './user-guides.js';
import { appUpdates } from './app-updates.js';
import safeStorage from '../utils/safeStorage.js';
import './TripOperations.css';
import './UserGuides.css';

function OfflineIcon({size=22}) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 2l20 20M8.5 8.5A11 11 0 0 1 22 10M2 10a15 15 0 0 1 3.7-2.5M6 14a9 9 0 0 1 3.4-1.7M10 18a3 3 0 0 1 4 0M12 21h.01" strokeLinecap="round"/></svg>;
}

export default function UserGuides({ driverId, autoOpen = false }) {
 const key=`gv_updates_seen:${driverId}:${appUpdates.id}`;
 const [open,setOpen]=useState(false),[mode,setMode]=useState('hub'),[topic,setTopic]=useState(0),[step,setStep]=useState(0),[expanded,setExpanded]=useState(false);
 const [read,setRead]=useState(()=>Boolean(safeStorage.getItem(key)));
 const prompted=useRef(false),touch=useRef(null),swiped=useRef(false);
 useEffect(()=>{setRead(Boolean(safeStorage.getItem(key)));},[key]);
 useEffect(()=>{if(driverId&&autoOpen&&!prompted.current&&!safeStorage.getItem(key)){prompted.current=true;setMode('updates');setStep(0);setOpen(true);}},[driverId,autoOpen,key]);
 const markRead=()=>{safeStorage.setItem(key,'1');setRead(true);prompted.current=true;};
 const close=()=>{if(mode==='updates')markRead();setOpen(false);setExpanded(false);};
 const hub=()=>{if(mode==='updates')markRead();setMode('hub');setExpanded(false);setStep(0);};
 const showUpdates=()=>{setMode('updates');setStep(0);setExpanded(false);};
 const choose=index=>{setTopic(index);setStep(0);setMode('guide');setExpanded(false);};
 const slides=mode==='updates'?appUpdates.slides:userGuides[topic].steps;
 const slide=slides[step];
 const move=index=>{setStep(index);setExpanded(false);};
 const last=step===slides.length-1;
 const title=mode==='hub'?'Ayuda y novedades':mode==='updates'?'Novedades de la app':userGuides[topic].label;
 return <>
  <button type="button" className="topbar-help-button" aria-label="Ayuda y novedades" title="Ayuda y novedades" onClick={()=>{setMode('hub');setStep(0);setExpanded(false);setOpen(true);}}>
   <IconInfo/>{!read&&<span className="topbar-help-dot" aria-label="Hay novedades"/>}
  </button>
  {open&&<TripOperationModal headerCaption={mode==='updates'?'NUEVA ACTUALIZACIÓN':'GV MOBILITY'} title={title} icon={<IconInfo/>} onClose={close}
   footer={mode==='hub'?<button type="button" className="trip-operation-done-btn" onClick={close}>Cerrar</button>:<div className="user-guides-footer">
    <div className="guide-progress" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={step+1}>{slides.map((_,i)=><i key={i} className={i<=step?'filled':''}/>)}</div>
    <div className="guide-footer-actions"><button type="button" className="trip-operation-done-btn" onClick={()=>step>0?move(step-1):hub()}>{step>0?'Atrás':'Todas las guías'}</button><button type="button" className="trip-ops-primary" onClick={()=>last?hub():move(step+1)}>{last?(mode==='updates'?'Explorar guías':'Listo'):'Siguiente'}</button></div>
   </div>}>
   <div className="visual-guide">
    {mode==='hub'?<div className="guide-hub">
     <button type="button" className="guide-news-card" onClick={showUpdates}><span className="guide-news-icon"><IconSparkles size={28}/></span><span><small>{read?'ACTUALIZACIÓN':'NUEVO'}</small><strong>Qué hay de nuevo</strong><span>Conoce las últimas mejoras</span></span><b aria-hidden="true">→</b></button>
     <div className="guide-hub-heading"><h3>Guías visuales</h3><span>Paso a paso</span></div>
     {userGuides.map((g,i)=>{const Icon=[IconUsers,TripTrailerIcon,OfflineIcon][i];return <button key={g.id} type="button" className={`guide-topic-card guide-topic-${g.id}`} data-guide-topic={g.id} onClick={()=>choose(i)}><span className="guide-topic-icon"><Icon size={26}/></span><span><strong>{g.label}</strong><small>{g.steps.length} pasos · Capturas reales</small></span><b aria-hidden="true">›</b></button>})}
    </div>:<>
     <div className="guide-slide-heading"><span className="guide-step-pill">{mode==='updates'?'Novedad':'Paso'} {step+1} de {slides.length}</span><button type="button" className="guide-index-button" onClick={hub}>Ver guías</button></div>
     <div className="user-guide-copy" aria-live="polite"><h3>{slide.title}</h3><p>{slide.text}</p></div>
     <button type="button" className={`user-guide-image ${expanded?'expanded':''}`} aria-label={expanded?'Reducir captura':'Ampliar captura'} aria-pressed={expanded} onClick={()=>{if(swiped.current){swiped.current=false;return;}setExpanded(!expanded);}}
      onTouchStart={e=>{touch.current=e.touches[0].clientX;swiped.current=false;}}
      onTouchEnd={e=>{const delta=(touch.current??e.changedTouches[0].clientX)-e.changedTouches[0].clientX;touch.current=null;if(Math.abs(delta)>60){swiped.current=true;if(delta>0&&!last)move(step+1);else if(delta<0&&step>0)move(step-1);}}}>
      <img key={slide.image} src={slide.image} alt={slide.alt}/><span>{expanded?'− Reducir captura':'+ Ampliar captura'}</span>
     </button>
     <div className="user-guide-dots" aria-label="Pasos">{slides.map((s,i)=><button key={s.title} type="button" aria-label={`Paso ${i+1}: ${s.title}`} aria-current={step===i?'step':undefined} onClick={()=>move(i)}/>)}</div>
     <small className="user-guide-note">Interfaz real · Datos de demostración</small>
    </>}
   </div>
  </TripOperationModal>}
 </>;
}
