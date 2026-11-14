import AppFeedbackModal from '../components/AppFeedbackModal.jsx';
import {useModalBack} from '../hooks/useModalBack.js';
import {dispatchModalBack} from '../services/modal-navigation.js';
import SupervisorNotifications,{stopApproverNotifications} from '../components/SupervisorNotifications.jsx';
import SupervisorUpdateNotice from '../components/SupervisorUpdateNotice.jsx';
import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';
import { getAdminSession, logoutAdmin, startSupervisorAppLogin, pollSupervisorAppLogin } from '../services/api.js';
import InspeccionesPage from './InspeccionesPage.jsx';
import ViajesPage from './ViajesPage.jsx';
import logo from '../assets/LOGOGV.png';
import {IconInspecciones,IconViajes} from '../components/Icons.jsx';
import './SupervisorApp.css';
const roleLabels={ADMINISTRADOR:'Administración',GERENTE:'Gerencia',GERENTE_GENERAL:'Gerencia general',COORDINADOR:'Coordinación',COORDINADOR_AREA:'Coordinación de área',COORDINADOR_QHSE:'Coordinación QHSE',SUPERVISOR:'Supervisión',QHSE:'QHSE',INSTRUCTOR:'Instructor'};
const roles=['ADMINISTRADOR','GERENTE','GERENTE_GENERAL','COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE','SUPERVISOR','QHSE','INSTRUCTOR'];
function SupervisorShell(){
 const[user,setUser]=useState(null),[loading,setLoading]=useState(true),[tab,setTab]=useState('pending'),[error,setError]=useState(''),[waiting,setWaiting]=useState(false);
 useModalBack(Boolean(user),()=>{if(tab==='trips')setTab('pending');else if(Capacitor.isNativePlatform())void NativeApp.minimizeApp();},false,-10);
 const ticket=useRef(null),checking=useRef(false),disposed=useRef(false);
 const clear=()=>{localStorage.removeItem('gv_supervisor_token');localStorage.removeItem('adminToken');setUser(null);};
 async function check(){
  if(!ticket.current||checking.current)return;const activeTicket=ticket.current;checking.current=true;
  try{const result=await pollSupervisorAppLogin(activeTicket);if(disposed.current||ticket.current!==activeTicket)return;
   if(!result?.data || typeof result.data.pending!=='boolean')throw new Error('El servidor no devolvió un estado de acceso válido. Intenta de nuevo.');
   if(!result.data.pending){
    if(typeof result.data.token!=='string'||!result.data.user)throw new Error('No se pudo confirmar la sesión. Inicia sesión de nuevo.');localStorage.setItem('gv_supervisor_token',result.data.token);localStorage.setItem('adminToken',result.data.token);ticket.current=null;setWaiting(false);setUser(result.data.user);await Browser.close().catch(()=>{});}
  }catch(e){if(!disposed.current){ticket.current=null;setWaiting(false);setError(e.message);}}
  finally{checking.current=false;}
 }
 useEffect(()=>{disposed.current=false;let listener,link;const expired=()=>{const hadToken=Boolean(localStorage.getItem('gv_supervisor_token'));clear();if(hadToken)setError('Tu sesión expiró. Inicia sesión de nuevo.');};window.addEventListener('supervisor-session-expired',expired);
  getAdminSession().then(r=>{if(!disposed.current)setUser(r?.data?.user || null);}).catch(()=>{}).finally(()=>{if(!disposed.current)setLoading(false);});
  const interval=setInterval(()=>void check(),2000);
  if(Capacitor.isNativePlatform()){
   NativeApp.addListener('appStateChange',state=>{if(state.isActive)void check();}).then(l=>{if(disposed.current)l.remove();else listener=l;});
   NativeApp.addListener('appUrlOpen',event=>{if(event.url.startsWith('gvsupervisor://auth')){void Browser.close().catch(()=>{});void check();}}).then(l=>{if(disposed.current)l.remove();else link=l;});
  }
  return()=>{disposed.current=true;clearInterval(interval);window.removeEventListener('supervisor-session-expired',expired);listener?.remove();link?.remove();};
 },[]);
 useEffect(()=>{
  if(!user)return;
  let timer;
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{void logout({keepNotifications:true});setError('La sesión se cerró por inactividad.');},20*60*1000);};
  const events=['pointerdown','keydown','scroll','touchstart'];events.forEach(event=>window.addEventListener(event,reset,{passive:true}));reset();
  return()=>{clearTimeout(timer);events.forEach(event=>window.removeEventListener(event,reset));};
 },[user]);
 useEffect(()=>{
  if(!user)return;let start=null;
  const begin=event=>{if(event.touches.length!==1)return;const target=event.target;if(target.closest('input,textarea,select,button,a,canvas,summary,.leaflet-container,.approval-pdf-body'))return;start={x:event.touches[0].clientX,y:event.touches[0].clientY};};
  const end=event=>{if(!start)return;const point=event.changedTouches[0],dx=point.clientX-start.x,dy=point.clientY-start.y,edge=start.x<26;start=null;
   if(Math.abs(dy)>45||Math.abs(dx)<90)return;
   if(edge&&dx>0&&dispatchModalBack(undefined,true))return;
   if(document.querySelector('dialog[open],.modal-overlay,.manejo-review-overlay,.approval-pdf-viewer'))return;
   if(dx<0&&tab==='pending')setTab('trips');else if(dx>0&&tab==='trips')setTab('pending');
  };
  const cancel=()=>{start=null;};window.addEventListener('touchstart',begin,{passive:true});window.addEventListener('touchend',end,{passive:true});window.addEventListener('touchcancel',cancel);
  return()=>{window.removeEventListener('touchstart',begin);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',cancel);};
 },[user,tab]);
 async function login(){setError('');setWaiting(true);try{const result=await startSupervisorAppLogin();
  if(!result?.data?.ticket || !result.data.pollToken || typeof result.data.authUrl!=='string' || !result.data.authUrl.startsWith('https://'))throw new Error('No se pudo preparar el acceso con Microsoft. Intenta de nuevo.');
  ticket.current={ticket:result.data.ticket,pollToken:result.data.pollToken};
  if(Capacitor.isNativePlatform())await Browser.open({url:result.data.authUrl});else window.open(result.data.authUrl,'_blank','noopener');
 }catch(e){setError(e.message);setWaiting(false);ticket.current=null;}}
 async function logout({keepNotifications=false}={}){if(!keepNotifications)await stopApproverNotifications();try{await logoutAdmin();}catch{}finally{ticket.current=null;setWaiting(false);clear();}}
 if(loading)return <main className="supervisor-loading">Validando sesión…</main>;
 if(user&&!roles.includes(user.rol))return <main className="supervisor-login"><h1>Acceso de supervisión requerido</h1><p>Tu cuenta no tiene permisos para revisar o autorizar viajes.</p><button onClick={logout}>Cerrar sesión</button></main>;
 if(!user)return <main className="supervisor-login"><img src={logo} alt="GV Mobility"/><h1>Aprobaciones</h1><p>Revisa inspecciones, autoriza y consulta viajes.</p><button disabled={waiting} onClick={login}>{waiting?'Esperando acceso de Microsoft…':'Iniciar sesión con Microsoft'}</button>{waiting&&<><p>Completa el acceso en el navegador y regresa a esta app.</p><button className="supervisor-secondary" onClick={()=>void check()}>Ya inicié sesión</button><button className="supervisor-secondary" onClick={()=>{ticket.current=null;setWaiting(false);}}>Cancelar</button></>}{error&&<AppFeedbackModal message={error} title="Acceso" type="error" onClose={()=>setError('')}/>}</main>;
 return <div className="supervisor-shell"><header className="supervisor-topbar"><img className="supervisor-brand-logo" src={logo} alt="GV Mobility"/><div className="supervisor-header-context"><h1 aria-label={tab==='pending'?'Pendientes de aprobación':'Viajes'}>{tab==='pending'?'Pendientes':'Viajes'}</h1><small>{roleLabels[user.rol]}</small><span className="supervisor-header-user" title={user.nombre}>{user.nombre}</span></div><button aria-label="Cerrar sesión" onClick={logout}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4H4v16h5M14 7l5 5-5 5M8 12h11"/></svg></button></header>
 <main className="supervisor-content">
 <SupervisorNotifications user={user} onNavigate={setTab}/>{tab==='pending'?<InspeccionesPage user={user} initialTab="inspecciones" pendingOnly/>:<ViajesPage user={user} readOnly/>}
 </main><nav className="supervisor-tabs" aria-label="Navegación de supervisor"><button aria-current={tab==='pending'?'page':undefined} onClick={()=>setTab('pending')}><IconInspecciones size={22}/><span>Pendientes</span></button><button aria-current={tab==='trips'?'page':undefined} onClick={()=>setTab('trips')}><IconViajes size={22}/><span>Viajes</span></button></nav></div>;
}

export default function SupervisorApp(){return <><SupervisorUpdateNotice/><SupervisorShell/></>;}
