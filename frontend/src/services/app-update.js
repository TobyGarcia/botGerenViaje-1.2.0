export function installAppUpdateRecovery({ serviceWorker, windowObject, documentObject }) {
  if (!serviceWorker?.addEventListener || !serviceWorker?.getRegistrations) return () => {};

  let reloading = false;
  const reloadForNewWorker = () => {
    if (reloading) return;
    reloading = true;
    windowObject.location.reload();
  };
  const checkForUpdates = () => {
    void serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.update())))
      .catch(() => {});
  };
  const checkWhenVisible = () => {
    if (documentObject.visibilityState === "visible") checkForUpdates();
  };

  serviceWorker.addEventListener("controllerchange", reloadForNewWorker);
  windowObject.addEventListener("focus", checkForUpdates);
  documentObject.addEventListener("visibilitychange", checkWhenVisible);
  windowObject.setTimeout(checkForUpdates, 1000);

  return () => {
    serviceWorker.removeEventListener("controllerchange", reloadForNewWorker);
    windowObject.removeEventListener("focus", checkForUpdates);
    documentObject.removeEventListener("visibilitychange", checkWhenVisible);
  };
}
