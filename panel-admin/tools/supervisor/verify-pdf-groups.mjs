import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||'http://127.0.0.1:58979/index.html';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9233',`--user-data-dir=${join(tmpdir(),'gv-approver-qa-'+process.pid)}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
for(let attempt=0;attempt<20;attempt++){try{const health=await fetch('http://127.0.0.1:9233/json/version');if(health.ok)break;}catch{}await wait(250);}
const tabs=await(await fetch('http://127.0.0.1:9233/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
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
async function review(width=390,extra=''){
 await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:qaPage+'?inspection-review=1&group-test=1'+extra});
 await until("Boolean(document.querySelector('.logistics-nav-tabs'))",'App missing');await wait(150);
 if(!await js("document.querySelector('.logistics-tab-btn').textContent.includes('Viajes locales')"))throw Error('Local group not labeled');
 if(await js("document.querySelector('.supervisor-content').textContent.includes('SOLO-EN-GERENCIAMIENTOS')"))throw Error('Management inspection duplicated in local group');
 await click('.logistics-tab-btn:last-child');
 await js("[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width>0&&/Ver revisión/.test(b.textContent)).click()");
 await until("Boolean(document.querySelector('.management-review-dialog'))&&!document.querySelector('.management-loading')",'Review missing');
}
async function pdfReady(){
 await until("Boolean(document.querySelector('.approval-pdf-viewer'))",'Viewer not open');
 for(let i=0;i<160;i++){
  const error=await js("document.querySelector('.approval-pdf-error')?.textContent");if(error)throw Error(error);
  if(await js("document.querySelector('.approval-pdf-canvas canvas')?.width>100&&!document.querySelector('.approval-pdf-body [role=status]')"))return;
  await wait(100);
 }
 throw Error('PDF did not render');
}
async function controlsFit(){
 const value=await js("(()=>{const r=document.querySelector('.approval-pdf-viewer').getBoundingClientRect();return {width:innerWidth,height:innerHeight,viewer:r.toJSON(),clipped:[...document.querySelectorAll('.approval-pdf-viewer header button,.approval-pdf-viewer nav button,.approval-pdf-viewer footer button')].filter(e=>{const b=e.getBoundingClientRect();return b.left<0||b.right>innerWidth||b.top<0||b.bottom>innerHeight}).length};})()");
 if(value.clipped||value.viewer.left<0||value.viewer.right>value.width||value.viewer.bottom>value.height)throw Error('PDF controls clipped '+JSON.stringify(value));
}
try{
 for(const width of [320,390,768]){
  await review(width);await js("window.open=()=>{throw Error('External PDF navigation prohibited')}");
  await click('.management-pdf-button');await pdfReady();await controlsFit();
  if(!await js("(()=>{const c=document.querySelector('.approval-pdf-canvas canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4!==3&&v<100)})()"))throw Error('PDF rendered blank');
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('tmp/approval-pdf-preview.png'),Buffer.from(shot.data,'base64'));}

  await click('.approval-pdf-viewer [aria-label="Pantalla completa"]');await controlsFit();
  await click('.approval-pdf-viewer footer button:last-child');
  await until("document.querySelector('.approval-pdf-viewer footer span')?.textContent==='2 / 2'&&!document.querySelector('.approval-pdf-body [role=status]')",'Next page missing');
  await click('.approval-pdf-viewer [aria-label="Acercar PDF"]');await wait(300);await controlsFit();
  await click('.pdf-return');await until("!document.querySelector('.approval-pdf-viewer')&&Boolean(document.querySelector('.management-review-dialog'))",'Return did not restore review');
  console.log('PASS local/GV separation, PDF full screen, zoom, pages, return '+width+'px');
 }
 await review();await click('#management-authorization-tab');
 await js("(()=>{const e=document.querySelector('.management-review-dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Observación conservada');e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.management-review-dialog canvas').scrollIntoView({block:'center'});})()");await wait(150);
 const point=await js("(()=>{const r=document.querySelector('.management-review-dialog canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+50,y:point.y+15,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+50,y:point.y+15,button:'left',clickCount:1});await wait(100);
 const signature=await js("document.querySelector('.management-review-dialog canvas').toDataURL()");
 for(const method of ['history','escape']){
  await click('.management-pdf-button');await pdfReady();
  if(method==='history')await js('history.back()');else await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until("!document.querySelector('.approval-pdf-viewer')",'Back did not close PDF');await wait(100);
  if(await js("document.querySelector('.management-review-dialog canvas').toDataURL()")!==signature||await js("document.querySelector('.management-review-dialog textarea').value")!=='Observación conservada')throw Error('Review draft lost');
 }
 console.log('PASS history Back/Escape preserve review tab, signature and comments');
 await js('window.__pdfFailure=true');await click('.management-pdf-button');await until("Boolean(document.querySelector('.approval-pdf-error'))",'No PDF error feedback');
 await click('.pdf-return');await until("!document.querySelector('.approval-pdf-viewer')",'Error view trapped user');
 console.log('PASS invalid/offline PDF keeps a working return button');
 await review(390,'&inspection-only-test=1');await click('#management-authorization-tab');
 if(!await js("document.querySelector('.management-review-footer').textContent.includes('Aprobar inspección')"))throw Error('Approved management lost pending inspection');
 console.log('PASS approved management still exposes its pending inspection in the management group');
 await js("document.querySelector('.management-review-dialog [aria-label=\"Cerrar revisión\"]').click()");
 await click('.logistics-tab-btn:first-child');await click('.btn-review');
 await js("[...document.querySelectorAll('.inspection-detail-modal-enhanced button')].find(b=>b.textContent.includes('Ver PDF')).click()");await pdfReady();await click('.pdf-return');
 await until("!document.querySelector('.approval-pdf-viewer')&&Boolean(document.querySelector('.inspection-detail-modal-enhanced'))",'Local inspection not restored');
 console.log('PASS local inspection PDFs use the same returnable viewer');
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
