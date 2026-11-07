// Mantiene las ayudas de pantalla del seguimiento sin reproducir audio.
let active = false;
let generation = 0;
let wakeLock = null;
let pendingWake = null;
let webLockController = null;
let releaseWebLock = null;

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

async function acquireWakeLock() {
  if (!active || !visible() || wakeLock || pendingWake || !globalThis.navigator?.wakeLock) return;
  const requestGeneration = generation;
  const request = globalThis.navigator.wakeLock.request('screen');
  pendingWake = request;
  try {
    const sentinel = await request;
    if (!active || generation !== requestGeneration || !visible()) {
      await sentinel.release().catch(() => {});
      return;
    }
    wakeLock = sentinel;
    sentinel.addEventListener('release', () => { if (wakeLock === sentinel) wakeLock = null; });
  } catch { /* El GPS continúa aunque el navegador rechace el bloqueo. */ }
  finally {
    if (pendingWake === request) pendingWake = null;
    if (active && generation !== requestGeneration) void acquireWakeLock();
  }
}

function acquireWebLock() {
  if (!active || webLockController || !globalThis.navigator?.locks) return;
  const controller = new AbortController();
  const requestGeneration = generation;
  webLockController = controller;
  globalThis.navigator.locks.request('pwa_gps_keepalive_lock', { mode: 'exclusive', signal: controller.signal }, () => {
    if (!active || generation !== requestGeneration) return;
    return new Promise(resolve => { releaseWebLock = resolve; });
  }).catch(() => {}).finally(() => {
    if (webLockController === controller) webLockController = null;
  });
}

function restoreLocks() {
  if (!active || !visible()) return;
  void acquireWakeLock();
  acquireWebLock();
}

export async function startTrackingAwake() {
  if (globalThis.Capacitor?.isPluginAvailable?.('NativeGps')) return;
  if (!active) {
    active = true;
    generation += 1;
    globalThis.document?.addEventListener('visibilitychange', restoreLocks);
    globalThis.window?.addEventListener('click', restoreLocks, { passive: true });
    globalThis.window?.addEventListener('touchstart', restoreLocks, { passive: true });
  }
  acquireWebLock();
  await acquireWakeLock();
}

export function stopTrackingAwake() {
  active = false;
  generation += 1;
  globalThis.document?.removeEventListener('visibilitychange', restoreLocks);
  globalThis.window?.removeEventListener('click', restoreLocks);
  globalThis.window?.removeEventListener('touchstart', restoreLocks);
  if (wakeLock) { void wakeLock.release().catch(() => {}); wakeLock = null; }
  webLockController?.abort();
  webLockController = null;
  releaseWebLock?.();
  releaseWebLock = null;
}
