import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9228',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9228/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9228/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:qaPage+'?manejo-test=1&role=GERENTE'});
  await until("Boolean(document.querySelector('.manejo-requests summary'))",'Manejo request missing');
  await click('.manejo-requests summary');await layout('manejo list '+width);
  await click('.manejo-request-list button');await layout('manejo review '+width);
  const bounds=await js("document.querySelector('.manejo-review').getBoundingClientRect().toJSON()");
  if(bounds.left<0||bounds.right>width+1||bounds.bottom>844||bounds.top<0)throw Error('Manejo modal overflow');
  if(!await js("document.querySelector('.manejo-review footer button:last-child').disabled"))throw Error('Unsigned approval enabled');
  console.log('PASS responsive manejo list/review '+width+'px');
 }
 await js("document.querySelector('.manejo-review canvas').scrollIntoView({block:'center'})");await wait(150);
 const point=await js("(()=>{const r=document.querySelector('.manejo-review canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+60,y:point.y+20,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+60,y:point.y+20,button:'left',clickCount:1});await wait(150);
 await click('.manejo-review footer button:last-child');
 await until("window.__manejoDecisions.length===1&&!document.querySelector('.manejo-review')&&!document.querySelector('.manejo-requests summary')",'Decision did not clear request');
 console.log('PASS signed decision sends once and removes request');
 for(const role of ['GERENTE','ADMINISTRADOR']){
  await send('Page.navigate',{url:qaPage+'?manejo-test=1&role='+role});await until("Boolean(document.querySelector('.manejo-requests summary'))",'Missing allowed role');
  await click('.manejo-requests summary');await click('.manejo-request-list button');
  await js('window.__resolveManejo();window.dispatchEvent(new Event("online"))');
  await until("!document.querySelector('.manejo-review')&&!document.querySelector('.manejo-requests summary')",'External decision left actionable review');
 }
 console.log('PASS manager/admin remote decision clears review silently');
 for(const role of ['SUPERVISOR','QHSE','INSTRUCTOR','COORDINADOR']){
  await send('Page.navigate',{url:qaPage+'?manejo-test=1&role='+role});await until("Boolean(document.querySelector('.logistics-nav-tabs'))",'App not loaded');await wait(200);
  if(await js("Boolean(document.querySelector('.manejo-requests'))||window.__manejoRequests!==0"))throw Error('Unauthorized manejo request '+role);
 }
 console.log('PASS unauthorized roles never fetch or display manejo requests');
}finally{ws.close();chrome.kill();}
