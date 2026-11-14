import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9231',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9231/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9231/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
async function openReview(width=390,height=844,extra=''){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:qaPage+'?inspection-review=1&live-test=1'+extra});
 await until("Boolean(document.querySelector('.tab-pending-badge'))",'App missing');
 await click('.logistics-tab-btn:last-child');
 await js("[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width>0&&/Ver revisión/.test(b.textContent)).click()");
 await until("Boolean(document.querySelector('.management-review-dialog'))&&!document.querySelector('.management-loading')",'Detail did not load');
}
async function fits(label){
 await layout(label);
 const r=await js("(()=>{const d=document.querySelector('.management-review-dialog'),b=document.querySelector('.management-review-body'),f=document.querySelector('.management-review-footer').getBoundingClientRect();return {overflow:b.scrollWidth>b.clientWidth+1,dialog:d.getBoundingClientRect().toJSON(),footer:f.toJSON()};})()");
 if(r.overflow||r.dialog.y<0||r.dialog.bottom>await js('innerHeight')||r.footer.bottom>await js('innerHeight'))throw Error(label+' overflow '+JSON.stringify(r));
}
try{
 for(const [width,height] of [[320,740],[390,844],[768,1024],[1440,1000],[740,390]]){
  await openReview(width,height);await fits('Trip '+width+'x'+height);
  if(await js("Boolean(document.querySelector('.supervisor-document-scroll'))"))throw Error('Letter sheet still embedded');
  await click('#management-inspection-tab');await fits('Inspection '+width+'x'+height);
  if(await js("document.querySelectorAll('#management-inspection-panel .damage-view-card').length")!==1)throw Error('Vehicle views not compact');
  if(!await js("document.querySelector('#management-inspection-panel').textContent.includes('Lleno · 100%')"))throw Error('Fuel F inaccurate');
  await click('.management-vehicle-views button:last-child');
  const image=await js("document.querySelector('#management-inspection-panel .damage-viewer-stage img').getBoundingClientRect().toJSON()");
  if(image.x<0||image.right>width)throw Error('Vehicle image cropped');
  await click('.management-checklist details summary');await fits('Checklist '+width);
  if(!await js("document.querySelector('.management-check-issues').textContent.includes('Extintor')&&document.querySelector('.management-check-issues').textContent.includes('Vidrios')"))throw Error('Issues not prominent');
  await click('.trailer-inspection-card summary');await fits('Trailer '+width);
  await click('#management-authorization-tab');await fits('Authorization '+width);
  if(!await js("[...document.querySelectorAll('.management-review-footer button')].find(b=>/Aprobar ambos/.test(b.textContent)).disabled"))throw Error('Unsigned approval enabled');
  console.log('PASS trip, inspection, checklist, trailer, authorization '+width+'x'+height);
 }
 await openReview();await click('#management-inspection-tab');
 const shot=await send('Page.captureScreenshot',{format:'png'});await mkdir(resolve('tmp'),{recursive:true});await writeFile(resolve('tmp/management-mobile-inspection.png'),Buffer.from(shot.data,'base64'));
 await click('#management-authorization-tab');
 await js("(()=>{const e=document.querySelector('.management-review-dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Revisión en curso');e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.management-review-dialog canvas').scrollIntoView({block:'center'});})()");await wait(150);
 const point=await js("(()=>{const r=document.querySelector('.management-review-dialog canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+60,y:point.y+20,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+60,y:point.y+20,button:'left',clickCount:1});await wait(150);
 const signature=await js("document.querySelector('.management-review-dialog canvas').toDataURL()");
 await click('#management-trip-tab');await click('#management-inspection-tab');await click('#management-authorization-tab');
 if(await js("document.querySelector('.management-review-dialog canvas').toDataURL()")!==signature||await js("document.querySelector('.management-review-dialog textarea').value")!=='Revisión en curso')throw Error('Review draft discarded between sections');
 if(await js("[...document.querySelectorAll('.management-review-footer button')].find(b=>/Aprobar ambos/.test(b.textContent)).disabled"))throw Error('Signed approval disabled');
 await js("window.__simulateOtherApprover('APROBADO');window.dispatchEvent(new Event('online'))");
 await until("document.querySelector('.management-review-dialog').textContent.includes('Documento APROBADO')",'Remote approval not reflected');
 if(await js("[...document.querySelectorAll('.management-review-footer button')].some(b=>/Aprobar ambos/.test(b.textContent))"))throw Error('Stale approval controls');
 console.log('PASS draft/signature preserved across sections and remote resolution removes actions');
 for(const role of ['SUPERVISOR','GERENTE']){
  await openReview(390,844,'&role='+role);await js("window.__simulateCancellation();window.dispatchEvent(new Event('online'))");
  await until("document.querySelector('.management-review-dialog').textContent.includes('Solicitud retirada')",'Cancellation not reflected');
  await click('#management-authorization-tab');
  if(await js("[...document.querySelectorAll('.management-review-footer button')].some(b=>/Aprobar ambos/.test(b.textContent))"))throw Error('Cancelled trip actionable');
 }
 console.log('PASS cancellation retires review for supervisor and manager');
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
