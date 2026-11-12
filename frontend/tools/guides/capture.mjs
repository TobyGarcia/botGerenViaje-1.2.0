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
await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const click=async selector=>{await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click()})()`);await wait(180)};
const change=async(selector,value)=>{await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const p=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(180)};
async function open(kind){await click(kind==='companions'?'.trip-operation-shortcut:first-child':'.trip-operation-shortcut:last-child');}
async function place(){await change('#trip-operation-place','Base');await js("document.querySelector('#trip-operation-place').focus()");await wait(180);await js("[...document.querySelectorAll('li')].find(el=>el.textContent.includes('Base de operaciones')).click()");await wait(180)}
async function trailer(){await open('trailers');await change('.trip-ops-trailer-form select','11');}
async function companion(){await open('companions');await click('[aria-label="Bajar a Ana López"]');await change('[aria-label="Nombre del acompañante 1"]','Luis Pérez');await place();}
const shots=[
 ['companions-open','.trip-operation-shortcut:first-child',async()=>{}],
 ['companions-edit','.trip-companions-editor',companion],
 ['companions-confirm','.trip-operation-dialog-footer',companion],
 ['trailer-select','.trip-ops-trailer-form',async()=>{await open('trailers') }],
 ['trailer-inspection','.signature-dialog-card',async()=>{await trailer();await click('.inspection-primary-button')}],
 ['trailer-confirm','.trip-operation-dialog-footer',async()=>{await trailer();for(let n=0;n<6;n++)await click('.inspection-primary-button');await click('.inspection-primary-button');await click('.trip-ops-checkbox-card input');await place()}],
 ['trailer-drop','.trip-ops-list',async()=>{await open('trailers');await click('[aria-label="Dejar REMOLQUE PLATAFORMA"]');await place()}],
 ['offline-banner','[data-capture="offline"]',async()=>{}],
 ['offline-queue','.gv-trip-operations > p[role="status"]',async()=>{}]
];
await mkdir(resolve('frontend/src/assets/guides'),{recursive:true});
try{for(const[name,selector,prepare]of shots){await send('Page.navigate',{url:`http://127.0.0.1:5178/tools/guides/index.html?stage=${name}`});await wait(1000);await prepare();await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Highlight not found '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});})()`);await wait(200);await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();const box=document.createElement('div');box.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #00a3dc;border-radius:12px;box-shadow:0 0 0 3px #fff,0 0 0 100vmax #0c24352b;box-sizing:border-box;';Object.assign(box.style,{left:Math.max(3,r.x-3)+'px',top:Math.max(3,r.y-3)+'px',width:Math.min(384,r.width+6)+'px',height:Math.min(838,r.height+6)+'px'});const badge=document.createElement('span');badge.textContent='${({'offline-banner':2,'offline-queue':3,'trailer-drop':4}[name] || (name.includes('open')||name.includes('select')?1:name.includes('confirm')?3:2))}';badge.style.cssText='position:absolute;top:3px;right:3px;background:#007fac;color:white;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:600 13px sans-serif;';box.append(badge);(document.querySelector('dialog[open]') || document.body).append(box)})()`);const clip=await js("(()=>{const modal=document.querySelector('dialog[open],.signature-dialog-card');const r=(modal||document.querySelector('.gv-trip-card')).getBoundingClientRect();const y=modal?Math.max(0,r.y-10):0;return {x:0,y:y+scrollY,width:390,height:Math.min(844-y,r.bottom-y+20),scale:1};})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip});await writeFile(resolve(`frontend/src/assets/guides/${name}.png`),Buffer.from(shot.data,'base64'));console.log(name+' captured');}}
finally{await send('Browser.close').catch(()=>{});ws.close();chrome.kill();}
