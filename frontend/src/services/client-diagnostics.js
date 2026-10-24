const STORAGE_KEY = "gv_diagnostics_v1";
const EVENTS = new Set(["API_ERROR", "JS_ERROR", "JS_REJECTION", "RENDER_ERROR", "GPS_STORAGE_ERROR",
  "OFFLINE_STORAGE_ERROR", "GPS_SYNC", "GPS_ERROR", "APP_UPDATE"]);
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
export function createDiagnostics({ storage, now = () => Date.now(), uuid = () => globalThis.crypto.randomUUID() } = {}) {
  let queue = [];
  let sender;
  let active = false;
  let retryAt = 0;
  let failures = 0;
  function clean(item) {
    if (!item || !EVENTS.has(item.event) || !validId(item.id)) return null;
    const age = now() - Date.parse(item.at);
    if (!Number.isFinite(age) || age < -300000 || age >= 7 * 86400000) return null;
    return { id: item.id, event: item.event,
      code: /^[A-Z0-9_]{1,60}$/.test(item.code || "") ? item.code : "CLIENT_FAILURE",
      path: /^\/api\/[a-zA-Z0-9_/-]{0,180}$/.test(item.path || "") ? item.path : "/client",
      status: Number.isInteger(item.status) && item.status >= 100 && item.status <= 599 ? item.status : 500,
      requestId: validId(item.requestId) ? item.requestId : undefined,
      version: /^[a-zA-Z0-9_.-]{1,100}$/.test(item.version || "") ? item.version : "local",
      at: new Date(item.at).toISOString(), online: typeof item.online === "boolean" ? item.online : null };
  }
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) queue = saved.slice(-100).map(clean).filter(Boolean);
  } catch {}
  const persist = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch {} };
  function record(event, meta = {}) {
    try {
      if (!EVENTS.has(event)) return;
      const code = /^[A-Z0-9_]{1,60}$/.test(meta.code || "") ? meta.code : "CLIENT_FAILURE";
      const path = /^\/api\/[a-zA-Z0-9_/-]{0,180}$/.test(meta.path || "") ? meta.path : "/client";
      // Deduplicate a burst; no payloads, messages, tokens, coordinates or arbitrary keys.
      if (queue.some(e => e.event === event && e.code === code && e.path === path && now() - Date.parse(e.at) < 30000)) return;
      queue = queue.filter(e => now() - Date.parse(e.at) < 7 * 86400000).slice(-99);
      queue.push({ id: uuid(), event, code, path, status: Number.isInteger(meta.status) ? meta.status : 500,
        requestId: meta.requestId, version: typeof __APP_VERSION__ === "undefined" ? "local" : __APP_VERSION__,
        at: new Date(now()).toISOString(), online: typeof navigator !== "undefined" ? navigator.onLine : null });
      persist();
    } catch { /* Logging must never break offline persistence. */ }
  }
  return {
    record,
    setSender(fn) { sender = fn; },
    async flush() {
      queue = queue.map(clean).filter(Boolean);
      if (active || !sender || now() < retryAt || !queue.length) return;
      active = true;
      const batch = queue.slice(0,10);
      try {
        const response = await sender(batch);
        const accepted = new Set(Array.isArray(response?.accepted) ? response.accepted : []);
        queue = queue.filter(e => !accepted.has(e.id));
        persist();
        failures = 0;
        retryAt = now() + 10000;
      } catch {
        failures++;
        retryAt = now() + Math.min(300000, 30000 * 2 ** Math.min(failures, 4));
      } finally { active = false; }
    },
    pending() { return queue.length; }
  };
}
let localStorage;
try { localStorage = globalThis.window?.localStorage; } catch {}
export const diagnostics = createDiagnostics({ storage: localStorage });

export function installClientDiagnostics(win = window) {
  const error = () => diagnostics.record("JS_ERROR", { code: "UNHANDLED_JS" });
  const rejection = () => diagnostics.record("JS_REJECTION", { code: "UNHANDLED_PROMISE" });
  const flush = () => { if (win.navigator?.onLine !== false) void diagnostics.flush(); };
  win.addEventListener("error", error);
  win.addEventListener("unhandledrejection", rejection);
  win.addEventListener("online", flush);
  const timer = win.setInterval(flush, 30000);
  flush();
  return () => {
    win.clearInterval(timer);
    win.removeEventListener("error", error);
    win.removeEventListener("unhandledrejection", rejection);
    win.removeEventListener("online", flush);
  };
}
