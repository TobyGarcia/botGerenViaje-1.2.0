import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTrackingAwake, stopTrackingAwake } from '../src/services/tracking-awake.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(request) {
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  globalThis.window = new EventTarget();
  globalThis.Audio = () => { throw new Error('No debe reproducir audio'); };
  globalThis.window.AudioContext = globalThis.Audio;
  const navigator = { wakeLock: { request } };
  Object.defineProperty(navigator, 'mediaSession', { get() { throw new Error('No debe usar multimedia'); } });
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
  delete globalThis.Capacitor;
}
function sentinel() {
  const result = new EventTarget(); result.releases = 0;
  result.release = async () => { result.releases++; result.dispatchEvent(new Event('release')); };
  return result;
}
afterEach(async () => { stopTrackingAwake(); await tick(); });

test('mantiene el bloqueo de pantalla sin audio y libera los recursos al detener', async () => {
  const screen = sentinel(); let requests = 0; let webReleased = false;
  setup(async () => { requests++; return screen; });
  navigator.locks = { request: async (name, options, callback) => {
    assert.equal(name, 'pwa_gps_keepalive_lock');
    await callback(); webReleased = true;
  } };
  await startTrackingAwake(); await startTrackingAwake();
  assert.equal(requests, 1);
  stopTrackingAwake(); await tick();
  assert.equal(screen.releases, 1); assert.equal(webReleased, true);
  window.dispatchEvent(new Event('click'));
  document.dispatchEvent(new Event('visibilitychange'));
  await tick(); assert.equal(requests, 1);
});

test('libera un permiso concedido tarde y recupera el bloqueo para el siguiente viaje', async () => {
  let grant; let requests = 0;
  const old = sentinel(), current = sentinel();
  setup(() => ++requests === 1 ? new Promise(resolve => { grant = resolve; }) : Promise.resolve(current));
  const starting = startTrackingAwake();
  stopTrackingAwake(); await startTrackingAwake();
  grant(old); await starting; await tick();
  assert.equal(old.releases, 1); assert.equal(requests, 2);
  stopTrackingAwake(); assert.equal(current.releases, 1);
});

test('un bloqueo rechazado no impide continuar y se puede recuperar al volver a la pantalla', async () => {
  const screen = sentinel(); let requests = 0;
  setup(async () => { if (++requests === 1) throw new Error('Permiso rechazado'); return screen; });
  await assert.doesNotReject(startTrackingAwake());
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  await tick(); assert.equal(requests, 1);
  document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
  await tick(); assert.equal(requests, 2);
  stopTrackingAwake(); assert.equal(screen.releases, 1);
});

test('el GPS nativo no solicita ayudas de pantalla web', async () => {
  setup(async () => { throw new Error('No debe solicitarse'); });
  globalThis.Capacitor = { isPluginAvailable: name => name === 'NativeGps' };
  await startTrackingAwake();
});
