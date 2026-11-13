import {useEffect,useRef,useState}from'react';
import {Capacitor,registerPlugin}from'@capacitor/core';
import {App}from'@capacitor/app';
import {apiFetch,readApiJson}from'../services/http-transport.js';
const native=registerPlugin('ApproverNotifications');
const enabled=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
let inFlight=null,generation=0;
export async function stopApproverNotifications(){generation++;if(enabled())await native.stop().catch(()=>{});}
async function activate(user,request=false){
 if(inFlight)return inFlight;
 const stamp=generation;
 inFlight=(async()=>{
  let state=await native.status();
  if(!state.granted){if(request)state=await native.ensurePermissions();if(!state.granted)return false;}
  if(stamp!==generation)return false;
  if(!state.bound||state.user!==String(user.idUsuarioAdmin||user.id_usuarios_admin)){
   const base=String(import.meta.env.VITE_API_BASE_URL||'').replace(/\/+$/,'').replace(/\/api$/,'');
   const response=await apiFetch(base+'/api/approver-notifications/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   const result=await readApiJson(response);if(!response.ok||!result.success)throw Error('No se pudieron activar los avisos.');
   if(stamp!==generation)return false;
   await native.configure({...result.data,user:String(user.idUsuarioAdmin||user.id_usuarios_admin)});
  }else await native.refresh();
  return true;
 })().finally(()=>{inFlight=null;});return inFlight;
}
export default function SupervisorNotifications({user,onNavigate}){
 const[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[denied,setDenied]=useState(false);const alive=useRef(true),navigate=useRef(onNavigate);navigate.current=onNavigate;
 async function start(request=false){setBusy(true);try{const ready=await activate(user,request);if(!alive.current)return;setDenied(!ready);setMessage(ready?'':'Activa las notificaciones para recibir los avisos de viajes.');}catch{if(alive.current)setMessage('No se pudieron activar los avisos. Reintenta con conexión.');}finally{if(alive.current)setBusy(false);}}
 useEffect(()=>{if(!enabled()||!user)return;alive.current=true;let listener,notificationListener;
  const key='gv_approver_notice_permission_asked';const asked=localStorage.getItem(key);localStorage.setItem(key,'1');void start(!asked);
  const tap=()=>void native.pendingAction().then(action=>{if(alive.current&&['trips','pending'].includes(action.tab))navigate.current(action.tab);}).catch(()=>{});tap();
  App.addListener('appStateChange',state=>{if(state.isActive){void start(false);tap();}}).then(l=>{if(!alive.current)l.remove();else listener=l;});
  native.addListener('notificationTap',action=>{if(alive.current&&['trips','pending'].includes(action.tab)){navigate.current(action.tab);void native.pendingAction().catch(()=>{});}}).then(l=>{if(!alive.current)l.remove();else notificationListener=l;});
  const interval=setInterval(()=>{if(!document.hidden)void start(false);},60000);
  return()=>{alive.current=false;clearInterval(interval);listener?.remove();notificationListener?.remove();};
 },[user?.idUsuarioAdmin,user?.id_usuarios_admin]);
 if(!enabled()||!message)return null;
 return <div className="supervisor-notification-banner" role="status"><span>{message}</span><button disabled={busy} onClick={()=>denied?void native.openSettings():void start(true)}>{busy?'Activando…':denied?'Permitir avisos':'Reintentar'}</button></div>;
}
