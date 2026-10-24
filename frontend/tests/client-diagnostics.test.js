import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDiagnostics } from "../src/services/client-diagnostics.js";

function memory() {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key,value) };
}

test("restored diagnostics discard expired or invalid records and never upload arbitrary stored fields", async () => {
  const storage = memory();
  let time = Date.now();
  const good = { id: randomUUID(), event: "API_ERROR", at: new Date(time).toISOString(), token: "SECRET" };
  storage.setItem("gv_diagnostics_v1", JSON.stringify([good, { ...good, id: "bad" },
    { ...good, id: randomUUID(), at: new Date(time - 8 * 86400000).toISOString() }]));
  const queue = createDiagnostics({ storage, now: () => time, uuid: randomUUID });
  assert.equal(queue.pending(), 1);
  let sent;
  queue.setSender(async batch => { sent = batch; return { accepted: [] }; });
  await queue.flush();
  assert.ok(!JSON.stringify(sent).includes("SECRET"));
  time += 8 * 86400000;
  await queue.flush();
  assert.equal(queue.pending(), 0);
});
test("failed upload preserves queue across reload and deletes only acknowledged events", async () => {
  const storage = memory();
  let time = Date.now();
  const a = createDiagnostics({ storage, now: () => time, uuid: randomUUID });
  a.record("API_ERROR", { code: "NETWORK_ERROR", path: "/api/viajes", token: "SECRET", latitud: 20 });
  a.setSender(async () => { throw new Error("offline"); });
  await a.flush();
  assert.equal(a.pending(), 1);
  const b = createDiagnostics({ storage, now: () => time, uuid: randomUUID });
  b.record("GPS_STORAGE_ERROR", { code: "INDEXEDDB_OPEN_FAILED" });
  let sent;
  b.setSender(async batch => { sent = batch; return { accepted: [batch[0].id] }; });
  await b.flush();
  assert.equal(b.pending(), 1);
  assert.ok(!JSON.stringify(sent).includes("SECRET"));
  assert.ok(!JSON.stringify(sent).includes("latitud"));
});

test("telemetry is bounded, deduplicated and survives full storage without touching trips", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  let time = Date.now();
  const a = createDiagnostics({ storage, now: () => time, uuid: randomUUID });
  for (let i = 0; i < 20; i++) a.record("JS_ERROR", { code: "UNHANDLED_JS" });
  assert.equal(a.pending(), 1);
  for (let i = 0; i < 150; i++) { time += 31000; a.record("JS_ERROR"); }
  assert.equal(a.pending(), 100);
});

test("backoff and in-flight guard prevent request storms and preserve new events", async () => {
  let time = Date.now(), calls = 0, resolve;
  const a = createDiagnostics({ storage: memory(), now: () => time, uuid: randomUUID });
  a.record("API_ERROR");
  a.setSender(async () => { calls++; throw new Error("server down"); });
  await a.flush(); await a.flush();
  assert.equal(calls, 1);
  time += 60001;
  a.setSender(batch => { calls++; return new Promise(done => { resolve = () => done({ accepted: batch.map(e => e.id) }); }); });
  const flushing = a.flush();
  await a.flush();
  a.record("GPS_ERROR");
  resolve(); await flushing;
  assert.equal(calls, 2);
  assert.equal(a.pending(), 1);
});
