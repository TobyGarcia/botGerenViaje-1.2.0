import test from "node:test";
import assert from "node:assert/strict";
import { watchAndroidUpdates } from "../src/services/update-checker.js";

function environment() {
  const win = new EventTarget(), doc = new EventTarget(); doc.hidden = false;
  let clock = 0, id = 0;
  const intervals = new Map();
  return { win, doc, intervals, now: () => clock, advance: () => { clock += 61000; }, timers: {
    setTimeout: () => ++id, clearTimeout() {}, setInterval: callback => { intervals.set(++id, callback); return id; }, clearInterval: key => intervals.delete(key)
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
test("descarta respuestas pendientes al desmontar y cancela la consulta", async () => {
  const env = environment(); let resolve, signal, deliveries = 0;
  const watcher = watchAndroidUpdates({ check: input => { signal = input; return new Promise(done => { resolve = done; }); }, onResult: () => deliveries++,
    windowObject: env.win, documentObject: env.doc, timers: env.timers, now: env.now });
  const pending = watcher.refresh(); await Promise.resolve(); watcher.stop(); resolve({ versionCode: 9 }); await pending;
  assert.equal(signal.aborted, true); assert.equal(deliveries, 0);
});
