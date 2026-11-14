import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9235',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9235/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9235/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
async function scene(extra=''){
 await send('Page.navigate',{url:qaPage+'?inspection-review=1'+extra});await until("Boolean(document.querySelector('.supervisor-tabs'))",'App missing');
}
async function swipe(from,to){
 await js(`(()=>{const el=document.querySelector('.supervisor-content'),touch=x=>new Touch({identifier:1,target:el,clientX:x,clientY:155});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(${from})],changedTouches:[touch(${from})]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[touch(${to})]}));})()`);await wait(200);
}
try{
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await scene();
  const header=await js("document.querySelector('.supervisor-topbar').textContent");if(/pruebas/i.test(header))throw Error('Environment label remains');
  if(await js("Boolean(document.querySelector('[aria-label=\"Buscar actualizaciones\"]'))"))throw Error('Manual update icon remains');
  await click('.supervisor-tabs button:last-child');await until("Boolean(document.querySelector('.trip-search-panel'))",'Trips missing');
  if(await js("document.querySelector('.trip-search-panel').open"))throw Error('Filters expanded by default');
  await click('.trip-search-panel summary');await layout('Filters '+width);
  await js("(()=>{const e=document.querySelector('.trips-toolbar input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'MIRAGE');e.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait(400);
  await click('.trip-search-panel summary');
  if(!await js("document.querySelector('.trip-search-panel summary').textContent.includes('1 filtro activo')"))throw Error('Collapsed filters lost active summary');
  await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ver detalle')).click()");await until("Boolean(document.querySelector('.trip-detail-grid'))",'Trip detail missing');await wait(400);
  const initial=await js("document.querySelector('[aria-label=\"Cerrar detalle\"]').getBoundingClientRect().toJSON()");
  if(Math.abs(initial.width-initial.height)>1||initial.right>width||initial.top<0)throw Error('Close button not square/aligned');
  await js("(()=>{const e=document.querySelector('.trip-detail-content-split');e.scrollTop=e.scrollHeight;})()");await wait(100);
  const end=await js("document.querySelector('[aria-label=\"Cerrar detalle\"]').getBoundingClientRect().toJSON()");
  if(Math.abs(end.y-initial.y)>1)throw Error('Close button scrolled away '+JSON.stringify({width,initial,end,dialog:await js("document.querySelector('.trip-detail-modal').getBoundingClientRect().toJSON()")}));
  const footer=await js("document.querySelector('.trip-detail-actions').getBoundingClientRect().toJSON()");if(footer.bottom>844)throw Error('Close footer clipped');
  await click('[aria-label="Cerrar detalle"]');console.log('PASS compact trips, retained filters and fixed square close '+width+'px');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await scene();await swipe(300,100);await until("Boolean(document.querySelector('.trip-search-panel'))",'Swipe to Trips failed');await swipe(100,300);await until("Boolean(document.querySelector('.logistics-nav-tabs'))",'Swipe to Pending failed');
 console.log('PASS horizontal swipes navigate Pending/Trips');
 await click('.logistics-tab-btn:last-child');await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ver revisión')).click()");await until("Boolean(document.querySelector('.management-review-dialog'))&&!document.querySelector('.management-loading')",'Review missing');
 await click('.management-pdf-button');await until("document.querySelector('.approval-pdf-canvas canvas')?.width>100&&!document.querySelector('.approval-pdf-body [role=status]')",'PDF not loaded',160);
 await js("(()=>{const el=document.querySelector('.approval-pdf-body');const t=(id,x)=>new Touch({identifier:id,target:el,clientX:x,clientY:350});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t(1,100),t(2,200)]}));el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(1,75),t(2,225)]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[t(1,75),t(2,225)]}));})()");
 await until("document.querySelector('.approval-pdf-tools span')?.textContent==='150%'",'Pinch zoom failed');await click('.pdf-return');await until("!document.querySelector('.approval-pdf-viewer')",'Return failed');
 console.log('PASS PDF pinch zoom and return');
 await scene('&decision-test=1');await click('.logistics-tab-btn:last-child');await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ver revisión')).click()");await until("Boolean(document.querySelector('.management-review-dialog'))&&!document.querySelector('.management-loading')",'Review missing');await click('#management-authorization-tab');
 await js("window.alert=()=>{throw Error('Native alert prohibited')};document.querySelector('.management-review-dialog canvas').scrollIntoView({block:'center'})");await wait(100);
 const point=await js("(()=>{const r=document.querySelector('.management-review-dialog canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+50,y:point.y+15,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+50,y:point.y+15,button:'left',clickCount:1});await wait(100);
 await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Aprobar ambos').click()");await until("Boolean(document.querySelector('.app-feedback-modal[open]'))",'Custom feedback missing');
 if(!await js("document.querySelector('.app-feedback-modal').textContent.includes('Aprobados')"))throw Error('Decision feedback incorrect');
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('tmp/supervisor-feedback-preview.png'),Buffer.from(shot.data,'base64'));
 await click('.app-feedback-close');await until("!document.querySelector('.app-feedback-modal')",'Notice close failed');
 console.log('PASS decision uses branded modal instead of native alert');
 await send('Page.navigate',{url:qaPage+'?login=1'});await until("Boolean(document.querySelector('.supervisor-login'))",'Login missing');if(/pruebas/i.test(await js("document.querySelector('.supervisor-login').textContent")))throw Error('Login environment label remains');
 console.log('PASS login branding has no testing label');
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
