import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9234',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9234/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9234/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
try{
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:qaPage+'?inspection-review=1&card-test=1'});
  await until("Boolean(document.querySelector('.approval-trip-card'))",'Local cards missing');
  const local=await js("document.querySelector('.approval-trip-card').textContent");
  if(!local.includes('ASPX - BASE PRINCIPAL CON NOMBRE COMPLETO')||!local.includes('ASPX - ALMACÉN CON NOMBRE COMPLETO')||!local.includes('Ana López')||!local.includes('MITSUBISHI L200'))throw Error('Local identity missing');
  if(local.includes('PENDIENTE-DEMO')||local.includes('AUTO-DEMO'))throw Error('Local card still shows folio/economic number');
  await click('.logistics-tab-btn:last-child');await until("Boolean(document.querySelector('.approval-trip-card'))",'Management cards missing');
  const text=await js("document.querySelector('.approval-trip-card').textContent");
  for(const value of ['ASPX - ORIGEN CON NOMBRE COMPLETO','ASPX - DESTINO CON NOMBRE COMPLETO','Ana López','MITSUBISHI L200'])if(!text.includes(value))throw Error('Management card missing '+value);
  if(text.includes('GEREN-DEMO')||text.includes('AUTO-010')||/\bauto\b/.test(text))throw Error('Management card shows category/IDs');
  await layout('Approval card '+width);
  if(await js("[...document.querySelectorAll('.approval-trip-card')].some(e=>e.scrollWidth>e.clientWidth+1)"))throw Error('Card content clipped');
  if(width===390){await js("document.querySelector('.approval-trip-card').scrollIntoView({block:'center'})");await wait(150);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('tmp/approval-trip-card-preview.png'),Buffer.from(shot.data,'base64'));}
  await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ver revisión')).click()");
  await until("Boolean(document.querySelector('.management-review-dialog'))&&!document.querySelector('.management-loading')",'Review did not load');
  if(!await js("document.querySelector('.management-review-dialog .form-panel-header p').textContent.includes('MITSUBISHI L200')"))throw Error('Detail still shows generic category');
  console.log('PASS local and management cards show full route, driver, actual vehicle and open review at '+width+'px');
 }
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
