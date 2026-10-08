import test from "node:test";
import assert from "node:assert/strict";
import { installAppUpdateRecovery } from "../src/services/app-update.js";

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); }
  };
}

test("recarga una sola vez cuando el service worker nuevo toma control", () => {
  const serviceWorker = { ...eventTarget(), getRegistrations: async () => [] };
  let reloads = 0;
  const windowObject = { ...eventTarget(), location: { reload: () => { reloads += 1; } }, setTimeout() {} };
  const documentObject = { ...eventTarget(), visibilityState: "visible" };

  installAppUpdateRecovery({ serviceWorker, windowObject, documentObject });
  serviceWorker.listeners.get("controllerchange")();
  serviceWorker.listeners.get("controllerchange")();

  assert.equal(reloads, 1);
});

test("busca actualizaciones al recuperar foco y visibilidad", async () => {
  let updates = 0;
  const serviceWorker = {
    ...eventTarget(),
    getRegistrations: async () => [{ update: async () => { updates += 1; } }]
  };
  const windowObject = { ...eventTarget(), location: { reload() {} }, setTimeout() {} };
  const documentObject = { ...eventTarget(), visibilityState: "visible" };

  installAppUpdateRecovery({ serviceWorker, windowObject, documentObject });
  windowObject.listeners.get("focus")();
  documentObject.listeners.get("visibilitychange")();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updates, 2);
});
