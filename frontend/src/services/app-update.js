export function installAppUpdateRecovery({ serviceWorker, windowObject, documentObject,
  version = typeof __APP_VERSION__ === 'undefined' ? null : __APP_VERSION__ }) {

  let reloading = false;
  let edited = false;
  let pending = false;
  let checking = false;
  const safe = () => {
    if (edited || documentObject.visibilityState !== 'visible' || windowObject.navigator?.onLine === false) return false;
    if (documentObject.querySelector?.('input:focus, textarea:focus, select:focus, [aria-busy="true"]')) return false;
    try {
      const storage = windowObject.localStorage;
      if (storage?.getItem('gerenciamiento_viajes_tracking_state')) return false;
      for (let i = 0; i < (storage?.length || 0); i++) {
        const key = storage.key(i);
        if (!key?.startsWith('gv_offline_trip_v1:')) continue;
        const value = JSON.parse(storage.getItem(key));
        if ((Array.isArray(value) ? value : [value]).some(record => record && !record.synced)) return false;
      }
    } catch { return false; }
    return true;
  };
  const reloadForNewWorker = () => {
    pending = true;
    if (reloading || !safe()) return;
    reloading = true;
    windowObject.location.reload();
  };
  const checkForUpdates = async () => {
    if (checking || windowObject.navigator?.onLine === false) return;
    checking = true;
    try {
      if (version && windowObject.fetch) {
        const response = await windowObject.fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
          const remote = await response.json();
          if (typeof remote.version === 'string' && remote.version !== version) pending = true;
        }
      }
      const registrations = await serviceWorker?.getRegistrations?.() || [];
      for (const registration of registrations) {
        await registration.update();
        if (registration.waiting) {
          pending = true;
          if (safe()) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        if (registration.installing) return;
      }
      if (pending && (!serviceWorker?.controller || registrations.length === 0)) reloadForNewWorker();
    } catch { /* Reintentar después; conservar la aplicación y sus datos offline. */ }
    finally { checking = false; }
  };
  const checkWhenVisible = () => {
    if (documentObject.visibilityState === "visible") checkForUpdates();
  };

  const markEdited = () => { edited = true; };
  serviceWorker?.addEventListener?.("controllerchange", reloadForNewWorker);
  documentObject.addEventListener('input', markEdited);
  windowObject.addEventListener('online', checkForUpdates);
  windowObject.addEventListener("focus", checkForUpdates);
  documentObject.addEventListener("visibilitychange", checkWhenVisible);
  const timeout = windowObject.setTimeout(checkForUpdates, 1000);
  const interval = windowObject.setInterval?.(checkForUpdates, 60000);

  return () => {
    serviceWorker?.removeEventListener?.("controllerchange", reloadForNewWorker);
    documentObject.removeEventListener('input', markEdited);
    windowObject.removeEventListener('online', checkForUpdates);
    windowObject.clearTimeout?.(timeout);
    windowObject.clearInterval?.(interval);
    windowObject.removeEventListener("focus", checkForUpdates);
    documentObject.removeEventListener("visibilitychange", checkWhenVisible);
  };
}
