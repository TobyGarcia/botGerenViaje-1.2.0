import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {listenForPdfBack} from '../services/pdf-back-navigation.js';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url';
import {loadApprovalPdf} from '../services/approval-pdf.js';
import './ApprovalPdfViewer.css';

const files=registerPlugin('ApprovalPdfFiles');

// Render inside the app: never replace the WebView with a PDF browser/plugin.
export default function ApprovalPdfViewer({document:request,onClose}){
 const[document,setDocument]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(300),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState('');
 const canvas=useRef(null),body=useRef(null),root=useRef(null),render=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const opener=globalThis.document.activeElement,previous=globalThis.document.body.style.overflow;
  globalThis.document.body.style.overflow='hidden';root.current?.querySelector('button')?.focus();
  const marker='pdf-'+Date.now()+'-'+Math.random();history.pushState({...history.state,gvPdfViewer:marker},'');
  const pop=()=>close.current();
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();}
   if(e.key==='Tab'){const controls=[...root.current.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&globalThis.document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&globalThis.document.activeElement===last){e.preventDefault();first?.focus();}}
  };
  window.addEventListener('popstate',pop);window.addEventListener('keydown',key,true);
  const removeNativeBack=listenForPdfBack(()=>close.current());
  return()=>{removeNativeBack();window.removeEventListener('popstate',pop);window.removeEventListener('keydown',key,true);globalThis.document.body.style.overflow=previous;
   if(history.state?.gvPdfViewer===marker)history.back();opener?.focus?.();};
 },[]);
 useEffect(()=>{
  const observer=new ResizeObserver(()=>setWidth(Math.max(100,(body.current?.clientWidth||332)-32)));observer.observe(body.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();let task,loaded;setBusy(true);setError('');setDocument(null);setPage(1);setZoom(1);
  (async()=>{try{
   const [pdfjs,bytes]=await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'),loadApprovalPdf({...request,signal:controller.signal})]);
   if(controller.signal.aborted)return;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
   task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true});loaded=await task.promise;
   if(controller.signal.aborted){await loaded.destroy();return;}setDocument(loaded);
  }catch(e){if(!controller.signal.aborted){setError(e.message||'No se pudo abrir el PDF.');setBusy(false);}}})();
  return()=>{controller.abort();render.current?.cancel();void task?.destroy().catch(()=>{});};
 },[request.kind,request.id,attempt]);
 useEffect(()=>{
  if(!document)return;let cancelled=false,task;
  setBusy(true);setError('');
  (async()=>{try{
   await render.current?.promise.catch(()=>{});if(cancelled)return;
   const current=await document.getPage(page);if(cancelled)return;
   const original=current.getViewport({scale:1}),viewport=current.getViewport({scale:(width/original.width)*zoom});
   const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(8000000/(viewport.width*viewport.height)));
   const node=canvas.current;node.width=Math.max(1,Math.floor(viewport.width*ratio));node.height=Math.max(1,Math.floor(viewport.height*ratio));node.style.width=viewport.width+'px';node.style.height=viewport.height+'px';
   task=current.render({canvas:node,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null});render.current=task;await task.promise;
   if(!cancelled){setBusy(false);body.current.scrollTo({top:0,left:0});}
  }catch(e){if(!cancelled&&e.name!=='RenderingCancelledException'){setError('No se pudo mostrar esta página. Puedes volver a la revisión.');setBusy(false);}}})();
  return()=>{cancelled=true;task?.cancel();};
 },[document,page,zoom,width]);
 async function save(){
  if(!document||saving)return;setSaving(true);setSaveMessage('');
  try{const bytes=await document.getData(),name=String(request.title||'viaje').replace(/[^A-Za-z0-9._-]/g,'_')+'.pdf';
   if(Capacitor.isNativePlatform()){
    let encoded='';for(let i=0;i<bytes.length;i+=32768)encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));
    const result=await files.save({data:btoa(encoded),name});setSaveMessage(result.cancelled?'Guardado cancelado.':'PDF guardado.');
   }else{
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=globalThis.document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setSaveMessage('Descarga iniciada.');
   }
  }catch(e){setSaveMessage(e.message||'No se pudo guardar el PDF.');}finally{setSaving(false);}
 }
 return createPortal(<div className="approval-pdf-overlay" onMouseDown={event=>event.stopPropagation()}><section ref={root} className={`approval-pdf-viewer ${expanded?'is-expanded':''}`} role="dialog" aria-modal="true" aria-labelledby="approval-pdf-title">
  <header><button type="button" className="pdf-return" onClick={()=>close.current()}>← Volver</button><div><small>Documento PDF</small><strong id="approval-pdf-title">{request.title||'Revisión del viaje'}</strong></div><button type="button" onClick={()=>setExpanded(value=>!value)} aria-label={expanded?'Salir de pantalla completa':'Pantalla completa'}>{expanded?'Reducir':'Ampliar'}</button></header>
  <nav className="approval-pdf-tools" aria-label="Zoom del PDF"><button type="button" aria-label="Alejar PDF" disabled={!document||zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.25))}>−</button><span>{Math.round(zoom*100)}%</span><button type="button" aria-label="Acercar PDF" disabled={!document||zoom>=2.5} onClick={()=>setZoom(value=>Math.min(2.5,value+.25))}>+</button><button type="button" disabled={!document} onClick={()=>setZoom(1)}>Ajustar ancho</button><button type="button" disabled={!document||saving} onClick={()=>void save()}>{saving?"Guardando…":"Guardar"}</button></nav>
  <div className="approval-pdf-body" ref={body} tabIndex={0} aria-label="Página del documento PDF">
   {busy&&<p role="status">Cargando PDF…</p>}
   {error&&<div role="alert" className="approval-pdf-error"><p>{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Reintentar</button><button type="button" onClick={()=>close.current()}>Volver a revisión</button></div>}
   <div className="approval-pdf-canvas"><canvas ref={canvas} aria-label={`Página ${page} de ${document?.numPages||'…'}`} hidden={!document||Boolean(error)}/></div>
  </div>
  {saveMessage&&<p className="approval-pdf-save-message" role="status">{saveMessage}</p>}
  <footer><button type="button" disabled={!document||page<=1||busy} onClick={()=>setPage(value=>value-1)}>← Anterior</button><span aria-live="polite">{document?`${page} / ${document.numPages}`:'—'}</span><button type="button" disabled={!document||page>=document.numPages||busy} onClick={()=>setPage(value=>value+1)}>Siguiente →</button></footer>
 </section></div>,globalThis.document.body);
}
