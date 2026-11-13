import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_BUILT==='true'?'http://127.0.0.1:5179/index.html':'http://127.0.0.1:5179/tools/supervisor/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9223',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9223/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9223/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const{ok,no}=pending.get(m.id);pending.delete(m.id);m.error?no(Error(JSON.stringify(m.error))):ok(m.result)}});
const send=(method,params={})=>new Promise((ok,no)=>{const key=++id;pending.set(key,{ok,no});ws.send(JSON.stringify({id:key,method,params}));});
const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
await send('Page.enable');
const layout=async label=>{
 const report=await js(`(()=>{const root=document.querySelector('.modal-card')||document.documentElement;return {width:innerWidth,scroll:document.documentElement.scrollWidth,modal:document.querySelector('.modal-card')?.getBoundingClientRect().toJSON()};})()`);
 const clipped=await js("[...document.querySelectorAll('.status-filter-chip,.geren-filters select,.geren-filters button,.supervisor-topbar,.supervisor-tabs button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1||r.right>innerWidth+1||(e.closest('.supervisor-tabs')&&r.bottom>innerHeight+1));}).map(e=>e.className)");
 if(clipped.length)throw Error(label+' clipped controls '+clipped.join(','));
 if(report.scroll>report.width+1)throw Error(label+' horizontal overflow '+JSON.stringify(report));
 if(report.modal&&(report.modal.x < -1 || report.modal.right>report.width+1))throw Error(label+' modal clipped '+JSON.stringify(report));
};
const click=async selector=>{await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0);if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()})()`);await wait(250)};
async function until(expression,label,limit=80){for(let i=0;i<limit;i++){if(await js(expression))return;await wait(100);}throw Error(label);}
async function openScene(tab='inspecciones'){
 await send('Page.navigate',{url:qaPage+'?live-test=1'});
 await until("Boolean(document.querySelector('.tab-pending-badge'))",'Initial pending missing');
 if(tab==='gerenciamiento')await click('.logistics-tab-btn:last-child');
}
try {
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const tab of ['inspecciones','gerenciamiento'])for(const state of ['APROBADO','RECHAZADO']){
  await openScene(tab);
  const active=await js("[...document.querySelectorAll('.logistics-tab-btn')].findIndex(button=>button.classList.contains('active'))");
  await js(`window.__simulateOtherApprover(${JSON.stringify(state)})`);
  await until("!document.querySelector('.tab-pending-badge')&&!document.querySelector('.supervisor-review-cards article')",'Remote decision did not update list and count');
  if(await js("[...document.querySelectorAll('.logistics-tab-btn')].findIndex(button=>button.classList.contains('active'))")!==active)throw Error('Unexpected navigation');
  if(await js('window.__liveAlerts')!==0)throw Error('Unexpected alert');
  console.log('PASS remote '+state+' in '+tab+': list/count refresh without navigation or alert');
 }
 await openScene('gerenciamiento');
 await js("[...document.querySelectorAll('button')].find(b=>/Ver revisión/.test(b.textContent)).click()");await wait(200);
 await js("(()=>{const e=document.querySelector('.modal-card textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Observación en curso');e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.modal-card canvas').scrollIntoView({block:'center'});})()");await wait(200);
 const point=await js("(()=>{const r=document.querySelector('.modal-card canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+60,y:point.y+20,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+60,y:point.y+20,button:'left',clickCount:1});await wait(150);
 const signature=await js("document.querySelector('.modal-card canvas').toDataURL()");const reads=await js('window.__liveReads');
 await until('window.__liveReads>'+String(reads+1),'No periodic refresh');await wait(150);
 if(await js("document.querySelector('.modal-card textarea').value")!=='Observación en curso')throw Error('Draft overwritten');
 if(await js("document.querySelector('.modal-card canvas').toDataURL()")!==signature)throw Error('Signature overwritten');
 await js("window.__simulateOtherApprover('APROBADO')");
 await until("document.querySelector('.modal-card')?.textContent.includes('Documento APROBADO')",'Open review stayed pending');
 if(await js("[...document.querySelectorAll('.modal-card button')].some(b=>b.textContent.trim()==='Aprobar ambos')"))throw Error('Stale approval action');
 if(await js('window.__liveAlerts')!==0)throw Error('Unexpected alert');
 console.log('PASS: refresh preserves draft/signature and updates open review after external approval');
 await openScene();await js("window.__liveOffline=true;window.__simulateOtherApprover('RECHAZADO')");await wait(5500);
 if(!await js("Boolean(document.querySelector('.tab-pending-badge'))"))throw Error('Network failure discarded prior state');
 await js("window.__liveOffline=false;window.dispatchEvent(new Event('online'))");
 await until("!document.querySelector('.tab-pending-badge')",'Reconnect did not refresh',30);
 if(await js('window.__liveAlerts')!==0)throw Error('Unexpected network alert');
 console.log('PASS: connection loss retains rows, reconnection refreshes silently');
 for(const tab of ['inspecciones','gerenciamiento']){
  await openScene(tab);
  if(tab==='inspecciones')await click('.btn-review');else{await js("[...document.querySelectorAll('button')].find(b=>/Ver revisión/.test(b.textContent)).click()");await wait(200);}
  await js('window.__simulateCancellation()');
  await until("!document.querySelector('.tab-pending-badge')&&document.body.textContent.includes('Solicitud retirada')",'Cancelled request stayed actionable');
  if(await js("[...document.querySelectorAll('.modal-card button,.inspection-detail-modal-enhanced button')].some(b=>/Aprobar ambos|Aprobar inspección/.test(b.textContent))"))throw Error('Cancelled request has approval controls');
  if(await js('window.__liveAlerts')!==0)throw Error('Cancellation generated an alert');
  console.log('PASS: cancellation retires '+tab+' and its open review without a new alert');
 }
 await openScene();await js('window.__simulateCancellation(true)');await wait(5500);
 if(!await js("Boolean(document.querySelector('.tab-pending-badge'))&&Boolean(document.querySelector('.btn-review'))"))throw Error('Shared inspection withdrawn');
 if(!await js("document.body.textContent.includes('VJ-ACTIVO-COMPARTIDO')"))throw Error('Shared request displays cancelled origin instead of valid consumer');
 await js("(()=>{const e=document.querySelector('.search-box-enhanced input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'VJ-ACTIVO-COMPARTIDO');e.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait(150);
 if(!await js("Boolean(document.querySelector('.btn-review'))"))throw Error('Shared request cannot be found by current trip folio');
 console.log('PASS: shared inspection remains pending under another valid trip');
} finally {await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
