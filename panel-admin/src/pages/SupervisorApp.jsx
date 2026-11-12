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
const roles=['ADMINISTRADOR','GERENTE','GERENTE_GENERAL','COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE','SUPERVISOR','QHSE','INSTRUCTOR'];
export default function SupervisorApp(){
 const[user,setUser]=useState(null),[loading,setLoading]=useState(true),[tab,setTab]=useState('pending'),[error,setError]=useState(''),[waiting,setWaiting]=useState(false);
 const ticket=useRef(null),checking=useRef(false),disposed=useRef(false);
 const clear=()=>{localStorage.removeItem('gv_supervisor_token');localStorage.removeItem('adminToken');setUser(null);};
 async function check(){
  if(!ticket.current||checking.current)return;const activeTicket=ticket.current;checking.current=true;
  try{const result=await pollSupervisorAppLogin(activeTicket);if(disposed.current||ticket.current!==activeTicket)return;
   if(!result.data.pending){localStorage.setItem('gv_supervisor_token',result.data.token);localStorage.setItem('adminToken',result.data.token);ticket.current=null;setWaiting(false);setUser(result.data.user);await Browser.close().catch(()=>{});}
  }catch(e){if(!disposed.current){ticket.current=null;setWaiting(false);setError(e.message);}}
  finally{checking.current=false;}
 }
 useEffect(()=>{disposed.current=false;let listener,link;const expired=()=>{const hadToken=Boolean(localStorage.getItem('gv_supervisor_token'));clear();if(hadToken)setError('Tu sesión expiró. Inicia sesión de nuevo.');};window.addEventListener('supervisor-session-expired',expired);
  getAdminSession().then(r=>{if(!disposed.current)setUser(r.data.user);}).catch(()=>{}).finally(()=>{if(!disposed.current)setLoading(false);});
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
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{void logout();setError('La sesión se cerró por inactividad.');},20*60*1000);};
  const events=['pointerdown','keydown','scroll','touchstart'];events.forEach(event=>window.addEventListener(event,reset,{passive:true}));reset();
  return()=>{clearTimeout(timer);events.forEach(event=>window.removeEventListener(event,reset));};
 },[user]);
 async function login(){setError('');setWaiting(true);try{const result=await startSupervisorAppLogin();ticket.current={ticket:result.data.ticket,pollToken:result.data.pollToken};
  if(Capacitor.isNativePlatform())await Browser.open({url:result.data.authUrl});else window.open(result.data.authUrl,'_blank','noopener');
 }catch(e){setError(e.message);setWaiting(false);ticket.current=null;}}
 async function logout(){try{await logoutAdmin();}catch{}finally{ticket.current=null;setWaiting(false);clear();}}
 if(loading)return <main className="supervisor-loading">Validando sesión…</main>;
 if(user&&!roles.includes(user.rol))return <main className="supervisor-login"><h1>Acceso de supervisión requerido</h1><p>Tu cuenta no tiene permisos para revisar o autorizar viajes.</p><button onClick={logout}>Cerrar sesión</button></main>;
 if(!user)return <main className="supervisor-login"><img src={logo} alt="GV Mobility"/><span className="supervisor-environment">PRUEBAS</span><h1>Supervisor</h1><p>Revisa pendientes y consulta tus viajes.</p><button disabled={waiting} onClick={login}>{waiting?'Esperando acceso de Microsoft…':'Iniciar sesión con Microsoft'}</button>{waiting&&<><p>Completa el acceso en el navegador y regresa a esta app.</p><button className="supervisor-secondary" onClick={()=>void check()}>Ya inicié sesión</button><button className="supervisor-secondary" onClick={()=>{ticket.current=null;setWaiting(false);}}>Cancelar</button></>}{error&&<p role="alert">{error}</p>}</main>;
 return <div className="supervisor-shell"><header className="supervisor-topbar"><img src={logo} alt="GV Mobility"/><span><strong>Supervisor</strong><small>Ambiente de pruebas</small></span><button aria-label="Cerrar sesión" onClick={logout}>Salir</button></header>
 <main className="supervisor-content"><div className="supervisor-welcome"><h1>{tab==='pending'?'Pendientes de aprobación':'Viajes'}</h1><p>{user.nombre}</p></div>
 {tab==='pending'?<InspeccionesPage user={user} initialTab="inspecciones" pendingOnly/>:<ViajesPage user={user} readOnly/>}
 </main><nav className="supervisor-tabs" aria-label="Navegación de supervisor"><button aria-current={tab==='pending'?'page':undefined} onClick={()=>setTab('pending')}><IconInspecciones size={22}/><span>Pendientes</span></button><button aria-current={tab==='trips'?'page':undefined} onClick={()=>setTab('trips')}><IconViajes size={22}/><span>Viajes</span></button></nav></div>;
}
