// Consulta al iniciar, recuperar foco/conexión y periódicamente, sin solapar peticiones.
export function watchAndroidUpdates({ check, onResult, onError = () => {}, onChecking = () => {},
  subscribeResume,
  windowObject = window, documentObject = document, timers = globalThis, now = () => Date.now() }) {
  let stopped = false, inFlight = null, lastCheck = -Infinity, controller;
  async function trigger(force = false) {
    if (stopped || inFlight || (!force && (documentObject.hidden || now() - lastCheck < 60000))) return inFlight;
    lastCheck = now(); controller = new AbortController();
    const requestController = controller;
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = timers.setTimeout(() => {
        requestController.abort();
        reject(new Error('Tiempo de espera agotado al consultar actualizaciones.'));
      }, 40000);
    });
    onChecking(true);
    inFlight = Promise.race([Promise.resolve().then(() => check(requestController.signal)), deadline]).then(result => {
      if (!stopped && !requestController.signal.aborted) onResult(result);
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
  windowObject.addEventListener("pageshow", refresh);
  let resumeListener;
  if (subscribeResume) Promise.resolve().then(() => subscribeResume(() => { void trigger(true); })).then(listener => {
    if (stopped) void listener?.remove(); else resumeListener = listener;
  }).catch(onError);
  const interval = timers.setInterval(refresh, 60000);
  void trigger();
  return { refresh: () => trigger(true), stop() {
    stopped = true; controller?.abort(); timers.clearInterval(interval);
    windowObject.removeEventListener("focus", refresh); windowObject.removeEventListener("online", refresh);
    documentObject.removeEventListener("visibilitychange", refresh);
    windowObject.removeEventListener("pageshow", refresh);
    void resumeListener?.remove();
  } };
}
