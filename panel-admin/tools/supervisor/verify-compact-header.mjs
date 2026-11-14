import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9236',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9236/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9236/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
 for(const width of [320,390,768])for(const role of ['QHSE','GERENTE','COORDINADOR_QHSE']){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:qaPage+'?role='+role});
  await until("Boolean(document.querySelector('.logistics-nav-tabs'))",'Pending missing');
  const image=await js("document.querySelector('.supervisor-brand-logo').getBoundingClientRect().toJSON()");
  if(Math.abs(image.width-174)>1||Math.abs(image.height-58)>1)throw Error('Logo differs from conductor size');
  if(await js("Boolean(document.querySelector('.supervisor-welcome'))"))throw Error('Duplicate page title remains');
  if(await js("document.querySelector('.supervisor-header-context h1').textContent")!=='Pendientes')throw Error('Header section missing');
  await layout('Header '+width+' '+role);
  const overflow=await js("[...document.querySelectorAll('.supervisor-topbar>*')].some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1})");
  if(overflow)throw Error('Header content clipped');
  if(width===390&&role==='QHSE'){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('tmp/compact-supervisor-header.png'),Buffer.from(shot.data,'base64'));}
  await click('.supervisor-tabs button:last-child');await until("Boolean(document.querySelector('.trip-search-panel'))",'Trips missing');
  if(await js("document.querySelector('.supervisor-header-context h1').textContent")!=='Viajes')throw Error('Trips heading not moved');
  await layout('Trips header '+width+' '+role);
  console.log('PASS conductor logo size and section/account header on both tabs '+width+'px '+role);
 }
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
