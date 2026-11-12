import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9223',`--user-data-dir=${join(tmpdir(),'gv-guide-captures')}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(1500);
const tabs=await(await fetch('http://127.0.0.1:9223/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const{ok,no}=pending.get(m.id);pending.delete(m.id);m.error?no(Error(JSON.stringify(m.error))):ok(m.result)}});
const send=(method,params={})=>new Promise((ok,no)=>{const key=++id;pending.set(key,{ok,no});ws.send(JSON.stringify({id:key,method,params}));});
const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
await send('Page.enable');
const layout=async label=>{
 const report=await js(`(()=>{const root=document.querySelector('.modal-card')||document.documentElement;return {width:innerWidth,scroll:document.documentElement.scrollWidth,modal:document.querySelector('.modal-card')?.getBoundingClientRect().toJSON()};})()`);
 if(report.scroll>report.width+1)throw Error(label+' horizontal overflow '+JSON.stringify(report));
 if(report.modal&&(report.modal.x < -1 || report.modal.right>report.width+1))throw Error(label+' modal clipped '+JSON.stringify(report));
};
const click=async selector=>{await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0);if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()})()`);await wait(250)};
try{for(const width of [320,360,390,600,768,844,1024,1280]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width===844?390:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://127.0.0.1:5179/tools/supervisor/index.html?login=1'});await wait(800);
 if(!await js("document.body.textContent.includes('Iniciar sesión con Microsoft')"))throw Error('Login missing');
 await send('Page.navigate',{url:'http://127.0.0.1:5179/tools/supervisor/index.html?invalid=1'});await wait(700);
 await click('.supervisor-login button');
 if(!await js("document.body.textContent.includes('El servidor no devolvió una respuesta válida')"))throw Error('Missing invalid-response error');
 if(await js("document.body.textContent.includes('Cannot read')"))throw Error('Null response crash');
 await send('Page.navigate',{url:'http://127.0.0.1:5179/tools/supervisor/index.html'});await wait(850);
 if(!await js("document.body.textContent.includes('PENDIENTE-DEMO')"))throw Error('Pending row missing');
 if(await js("document.body.textContent.includes('APROBADA-OCULTA')"))throw Error('Pending filter wrong');
 await layout('list');
 if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'gv-supervisor-pending.png'),Buffer.from(shot.data,'base64'));}
 await click('.btn-review');if(!await js("Boolean(document.querySelector('.inspection-detail-modal-enhanced'))"))throw Error('Inspection details missing');
 await layout('inspection');
 await js("document.querySelector('.close-modal-btn').click()");await wait(100);
 await click('.logistics-tab-btn:last-child');await wait(400);
 await layout('gerenciamientos');
 await js("[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width>0&&/Ver revisión/.test(b.textContent)).click()");await wait(150);
 if(!await js("Boolean(document.querySelector('.supervisor-geren-summary'))"))throw Error('Missing readable trip summary');
 if(await js("Boolean(document.querySelector('.supervisor-document').open)"))throw Error('Full document must start collapsed');
 await layout('gerenciamiento detail');
 await js("document.querySelector('.inspection-decision-actions').scrollIntoView({block:'end'})");
 const actions=await js("(()=>{const r=document.querySelector('.inspection-decision-actions').getBoundingClientRect();return {bottom:r.bottom,top:r.top,height:innerHeight};})()");
 if(actions.bottom>actions.height+1||actions.top<0)throw Error('Decision actions inaccessible '+JSON.stringify(actions));
 if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'gv-supervisor-approval.png'),Buffer.from(shot.data,'base64'));}
 await js("document.querySelector('.modal-card .close-button').click()");await wait(100);
 await click('.supervisor-tabs button:last-child');await wait(700);
 if(!await js("document.body.textContent.includes('VJ-DEMO-0041')"))throw Error('Trips missing '+await js("document.body.textContent.slice(-1200)"));
 if(await js("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Eliminar')"))throw Error('Unexpected delete');
 await click('.table-actions .edit-button');
 if(await js("document.querySelector('#trip-detail-title')?.textContent.trim()")!=='VJ-DEMO-0041')throw Error('Trip detail missing');
 if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'gv-supervisor-trip.png'),Buffer.from(shot.data,'base64'));}
 await layout('trip');
 console.log('PASS '+width+'px: Microsoft login screen, pending filter, inspection review, trips and detail, no delete');
}
 for(const role of ['SUPERVISOR','QHSE','COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE','INSTRUCTOR','GERENTE','GERENTE_GENERAL','ADMINISTRADOR']){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://127.0.0.1:5179/tools/supervisor/index.html?role='+role});await wait(500);
 if(!await js("Boolean(document.querySelector('.supervisor-tabs'))"))throw Error('Role denied '+role);
 await layout(role);console.log('PASS role '+role);
 }
}finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}

