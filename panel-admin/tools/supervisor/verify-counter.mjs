import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const qaPage=process.env.SUPERVISOR_QA_URL||(process.env.SUPERVISOR_QA_BUILT==='true'?'http://127.0.0.1:5179/index.html':'http://127.0.0.1:5179/tools/supervisor/index.html');
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
try {
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:qaPage+'?decision-test=1'});
 for(let attempt=0;attempt<40;attempt++){await wait(100);if(await js("Boolean(document.querySelector('.tab-pending-badge'))"))break;}
 if(await js("document.querySelector('.tab-pending-badge')?.textContent.trim()")!=='1')throw Error('Expected one pending inspection');
 await click('.logistics-tab-btn:last-child');await wait(300);
 await js("[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width>0&&/Ver revisión/.test(b.textContent)).click()");await wait(200);
 await click('#management-authorization-tab');
 await js("document.querySelector('.modal-card canvas').scrollIntoView({block:'center'})");await wait(150);
 const point=await js("(()=>{const r=document.querySelector('.modal-card canvas').getBoundingClientRect();return{x:r.x+20,y:r.y+30};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+60,y:point.y+20,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+60,y:point.y+20,button:'left',clickCount:1});await wait(150);
 await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aprobar ambos');if(!b||b.disabled)throw Error('Joint approval disabled');b.click()})()");
 for(let attempt=0;attempt<40;attempt++){await wait(100);if(await js("window.__decisionRequests===1&&!document.querySelector('.tab-pending-badge')"))break;}
 if(!await js("window.__decisionRequests===1&&!document.querySelector('.tab-pending-badge')"))throw Error('Inspection counter did not refresh');
 if(!await js("document.querySelector('.logistics-tab-btn.active')?.textContent.includes('Gerenciamientos')"))throw Error('Unexpected tab navigation');
 console.log('PASS: one joint approval clears inspection counter while remaining on Gerenciamientos');
} finally {await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
