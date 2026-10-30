// Consulta al iniciar, recuperar foco/conexión y periódicamente, sin solapar peticiones.
export function watchAndroidUpdates({ check, onResult, onError = () => {}, onChecking = () => {},
  windowObject = window, documentObject = document, timers = globalThis, now = () => Date.now() }) {
  let stopped = false, inFlight = null, lastCheck = -Infinity, controller;
  async function trigger(force = false) {
    if (stopped || inFlight || (!force && (documentObject.hidden || now() - lastCheck < 60000))) return inFlight;
    lastCheck = now(); controller = new AbortController();
    const timeout = timers.setTimeout(() => controller.abort(), 10000);
    onChecking(true);
    inFlight = Promise.resolve().then(() => check(controller.signal)).then(result => {
      if (!stopped && !controller.signal.aborted) onResult(result);
    }).catch(error => { if (!stopped) onError(error); }).finally(() => {
      timers.clearTimeout(timeout); inFlight = null;
      if (!stopped) onChecking(false);
    });
    return inFlight;
  }
  const refresh = () => { void trigger(); };
  windowObject.addEventListener("focus", refresh);
  windowObject.addEventListener("online", refresh);
  documentObject.addEventListener("visibilitychange", refresh);
  const interval = timers.setInterval(refresh, 300000);
  void trigger();
  return { refresh: () => trigger(true), stop() {
    stopped = true; controller?.abort(); timers.clearInterval(interval);
    windowObject.removeEventListener("focus", refresh); windowObject.removeEventListener("online", refresh);
    documentObject.removeEventListener("visibilitychange", refresh);
  } };
}
