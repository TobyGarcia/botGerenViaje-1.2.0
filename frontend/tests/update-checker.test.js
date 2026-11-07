import test from "node:test";
import assert from "node:assert/strict";
import { watchAndroidUpdates } from "../src/services/update-checker.js";

function environment() {
  const win = new EventTarget(), doc = new EventTarget(); doc.hidden = false;
  let clock = 0, id = 0;
  const intervals = new Map(), timeouts = new Map();
  return { win, doc, intervals, timeouts, now: () => clock, advance: () => { clock += 61000; }, timers: {
    setTimeout: callback => { timeouts.set(++id, callback); return id; }, clearTimeout: key => timeouts.delete(key), setInterval: callback => { intervals.set(++id, callback); return id; }, clearInterval: key => intervals.delete(key)
  } };
}
test("busca sin login, al recuperar foco/conexión y manualmente sin solapar", async () => {
  const env = environment(); let checks = 0, result;
  const watcher = watchAndroidUpdates({ check: async () => { checks++; return { versionCode: 8 }; }, onResult: value => { result = value; },
    windowObject: env.win, documentObject: env.doc, timers: env.timers, now: env.now });
  await watcher.refresh();
  assert.equal(checks, 1); assert.equal(result.versionCode, 8);
  env.win.dispatchEvent(new Event("focus")); env.win.dispatchEvent(new Event("online"));
  await Promise.resolve(); assert.equal(checks, 1);
  env.advance(); env.win.dispatchEvent(new Event("focus")); await watcher.refresh();
  assert.equal(checks, 2);
  await watcher.refresh(); assert.equal(checks, 3);
  watcher.stop(); env.advance(); env.win.dispatchEvent(new Event("online")); await Promise.resolve();
  assert.equal(checks, 3); assert.equal(env.intervals.size, 0);
});

test('una consulta nativa bloqueada vence y permite detectar una publicación sin cerrar sesión', async () => {
  const env=environment();let checks=0, late, delivered;
  const watcher=watchAndroidUpdates({check:()=>++checks===1?new Promise(resolve=>{late=resolve;}):Promise.resolve({versionCode:31}),onResult:value=>{delivered=value;},
    windowObject:env.win,documentObject:env.doc,timers:env.timers,now:env.now});
  const first=watcher.refresh();await Promise.resolve();
  for(const expire of [...env.timeouts.values()])expire();
  await first;
  await watcher.refresh();assert.equal(delivered.versionCode,31);assert.equal(checks,2);
  late({versionCode:29});await Promise.resolve();assert.equal(delivered.versionCode,31);
  watcher.stop();assert.equal(env.timeouts.size,0);
});

test('el regreso nativo consulta aunque Android no emita foco ni visibilidad web, y limpia el listener', async () => {
  const env=environment();let resume,checks=0,removed=0;
  const watcher=watchAndroidUpdates({check:async()=>{checks++;return null;},onResult:()=>{},subscribeResume:callback=>{resume=callback;return Promise.resolve({remove:()=>{removed++;}});},
    windowObject:env.win,documentObject:env.doc,timers:env.timers,now:env.now});
  await watcher.refresh();env.doc.hidden=true;resume();await watcher.refresh();
  assert.equal(checks,2);watcher.stop();assert.equal(removed,1);resume();await Promise.resolve();assert.equal(checks,2);
});

test('detecta una versión publicada durante la misma sesión mediante la consulta periódica', async () => {
  const env=environment();let available=null,delivered;
  const watcher=watchAndroidUpdates({check:async()=>available,onResult:value=>{delivered=value;},windowObject:env.win,documentObject:env.doc,timers:env.timers,now:env.now});
  await watcher.refresh();assert.equal(delivered,null);
  available={versionCode:31};env.advance();[...env.intervals.values()][0]();await watcher.refresh();
  assert.equal(delivered.versionCode,31);watcher.stop();
});
test("descarta respuestas pendientes al desmontar y cancela la consulta", async () => {
  const env = environment(); let resolve, signal, deliveries = 0;
  const watcher = watchAndroidUpdates({ check: input => { signal = input; return new Promise(done => { resolve = done; }); }, onResult: () => deliveries++,
    windowObject: env.win, documentObject: env.doc, timers: env.timers, now: env.now });
  const pending = watcher.refresh(); await Promise.resolve(); watcher.stop(); resolve({ versionCode: 9 }); await pending;
  assert.equal(signal.aborted, true); assert.equal(deliveries, 0);
});
