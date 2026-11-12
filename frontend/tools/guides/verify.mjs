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
const key='gv_updates_seen:capture-test:2026-11-visual-guides-v2';
const click=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(100)};
try {
 for(const width of [320,390,768]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:'http://127.0.0.1:5178/tools/guides/carousel.html?active=1'});await wait(700);
  await js(`localStorage.removeItem('${key}')`);await send('Page.reload');await wait(600);
  if(await js("Boolean(document.querySelector('dialog[open]'))"))throw Error('Interrupted active trip');
  if(!await js("(()=>{const a=document.querySelector('.topbar-help-button').getBoundingClientRect(),b=document.querySelector('.topbar-btn-logout-icon').getBoundingClientRect();return a.right<=b.left&&b.right<=innerWidth})()"))throw Error('Help icon positioning');
  await click('.topbar-help-button');
  if(await js("document.querySelectorAll('[data-guide-topic]').length")!==3)throw Error('Missing guide menu');
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(tmpdir(),'gv-help-hub.png'),Buffer.from(shot.data,'base64'));}
  for(const [topic,count] of [['companions',3],['trailers',4],['offline',3]]) {
   await click(`[data-guide-topic="${topic}"]`);
   for(let step=0;step<count;step++) {
    if(!await js("(()=>{const img=document.querySelector('.user-guide-image img');return img.complete&&img.naturalWidth>0})()"))throw Error('Broken screenshot');
    if(!await js(`document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='${step+1}'`))throw Error('Wrong step');
    if(!await js("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})()"))throw Error('Overflow');
    if(step<count-1)await click('.guide-footer-actions .trip-ops-primary');
   }
   await click('.guide-index-button');
  }
  await click('[data-guide-topic="companions"]');await click('.user-guide-image');
  if(!await js("document.querySelector('.user-guide-image').classList.contains('expanded')"))throw Error('Zoom');
  await click('.user-guide-image');
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(tmpdir(),'gv-help-carousel.png'),Buffer.from(shot.data,'base64'));}
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(100);
  if(await js(`localStorage.getItem('${key}')`))throw Error('Manual guide marked updates read');
  await send('Page.navigate',{url:'http://127.0.0.1:5178/tools/guides/carousel.html'});await wait(650);
  if(await js("document.querySelector('#trip-operation-modal-title').textContent")!=='Novedades de la app')throw Error('No automatic updates');
  for(let step=0;step<3;step++){if(!await js(`document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='${step+1}'`))throw Error('Update navigation');await click('.guide-footer-actions .trip-ops-primary');}
  if(!await js(`localStorage.getItem('${key}')`))throw Error('Updates not persisted');
  await click('.trip-operation-close-btn');await send('Page.reload');await wait(650);
  if(await js("Boolean(document.querySelector('dialog[open]'))"))throw Error('Read updates repeated');
  await click('.topbar-help-button');await click('.guide-news-card');
  if(await js("document.querySelector('#trip-operation-modal-title').textContent")!=='Novedades de la app')throw Error('Cannot replay updates');
  console.log('PASS '+width+'px: info by logout; no active-trip interruption; 10 guide steps; 3 updates; zoom; independent read persistence; replay');
 }
} finally {await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
