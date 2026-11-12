import {validateSupervisorUpdate} from '../services/supervisor-update.js';
import {useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {apiFetch,readApiJson} from '../services/http-transport.js';
import {watchAndroidUpdates} from '../../../frontend/src/services/update-checker.js';
import SupervisorUpdateDialog from './SupervisorUpdateDialog.jsx';
const version=registerPlugin('AndroidVersion');
export const supervisorUpdateEnabled=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
export default function SupervisorUpdateNotice(){
 const[update,setUpdate]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[stage,setStage]=useState(''),[progress,setProgress]=useState(null),[ready,setReady]=useState(0),[snooze,setSnooze]=useState(0),[editing,setEditing]=useState(false),[feedback,setFeedback]=useState('');
 useEffect(()=>{
  if(!supervisorUpdateEnabled())return;
  let manual=false;
  const watcher=watchAndroidUpdates({check:async signal=>{
   const installed=await version.getInfo();
   const base=String(import.meta.env.VITE_API_BASE_URL||'').replace(/\/+$/,'').replace(/\/api$/,'');
   const response=await apiFetch(`${base}/api/android/update?application=supervisor&channel=testing&_t=${Date.now()}`,{signal,cache:'no-store'});
   if(!response.ok)throw Error('No se pudo consultar la actualización.');
   return validateSupervisorUpdate(await readApiJson(response),installed);
  },onResult:result=>{setUpdate(result);if(manual)setFeedback(result?'':'Ya tienes la versión más reciente.');manual=false;},onError:()=>{if(manual)setFeedback('No se pudo consultar. Revisa tu conexión e intenta de nuevo.');manual=false;},subscribeResume:callback=>version.addListener('appResumed',callback)});
  const refresh=()=>{manual=true;setSnooze(0);setFeedback('Buscando actualizaciones…');void watcher.refresh();};
  window.addEventListener('supervisor-check-update',refresh);
  return()=>{watcher.stop();window.removeEventListener('supervisor-check-update',refresh);};
 },[]);
 useEffect(()=>{const check=()=>setEditing(Boolean(document.querySelector('.modal-overlay')));const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});check();return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!snooze)return;const timer=setTimeout(()=>setSnooze(0),Math.max(0,snooze-Date.now()));return()=>clearTimeout(timer);},[snooze]);
 useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(''),5000);return()=>clearTimeout(timer);},[feedback]);
 useEffect(()=>{if(stage!=='downloading')return;let active=true;const timer=setInterval(()=>void version.getDownloadStatus().then(s=>{if(active)setProgress(s.progress>=0?s.progress:null);}).catch(()=>{}),500);return()=>{active=false;clearInterval(timer);};},[stage]);
 async function download(){setBusy(true);setMessage('');try{
  if(document.querySelector('.modal-overlay'))throw Error('Termina la revisión antes de actualizar.');
  if(ready!==update.versionCode){setStage('downloading');await version.downloadUpdate({url:update.downloadUrl,sha256:update.sha256,versionCode:update.versionCode});setReady(update.versionCode);}
  setStage('installing');const result=await version.installUpdate();setMessage(result.permissionRequired?'Activa «Permitir desde esta fuente» y regresa para instalar.':'Confirma la actualización en el instalador de Android.');
 }catch(error){setMessage(error.message||'No se pudo actualizar. Intenta nuevamente.');}finally{setBusy(false);setStage('');setProgress(null);}}
 if(!supervisorUpdateEnabled())return null;
 if(!update||editing||Date.now()<snooze)return feedback?<div className="supervisor-update-toast" role="status">{feedback}</div>:null;
 return <SupervisorUpdateDialog version={update.versionName} message={message} checking={busy} stage={stage} progress={progress} ready={ready===update.versionCode} onDownload={download} onLater={()=>{setSnooze(Date.now()+30*60000);setMessage('');}}/>;
}
