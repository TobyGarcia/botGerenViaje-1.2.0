import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = { setTimeout, clearTimeout };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });

const { getCurrentLocation } = await import("../src/services/location-provider.js");

function browserPosition(overrides = {}) {
  return {
    coords: { latitude: 19.4326, longitude: -99.1332, accuracy: 8, speed: 2, heading: 90, ...overrides },
    timestamp: Date.parse("2026-10-08T15:00:00.000Z")
  };
}

test("identifica y normaliza una captura proveniente de la PWA", async () => {
  window.Telegram = undefined;
  navigator.geolocation = { getCurrentPosition: success => success(browserPosition()) };
  const result = await getCurrentLocation();
  assert.equal(result.origenCaptura, "PWA");
  assert.equal(result.velocidad, 7.2);
  assert.equal(result.fechaGps, "2026-10-08T15:00:00.000Z");
});

test("identifica una captura proveniente de Telegram Mini App", async () => {
  window.Telegram = { WebApp: { initData: "signed", LocationManager: {
    isInited: true, isLocationAvailable: true,
    getLocation: callback => callback({ latitude: 20.1, longitude: -90.2, horizontal_accuracy: 12 })
  } } };
  const result = await getCurrentLocation();
  assert.equal(result.origenCaptura, "TELEGRAM_MINI_APP");
  assert.equal(result.latitud, 20.1);
});

test("Telegram usa la geolocalización del navegador como respaldo sin perder el origen", async () => {
  window.Telegram = { WebApp: { initData: "signed", LocationManager: {
    isInited: true, isLocationAvailable: true, getLocation: callback => callback(null)
  } } };
  navigator.geolocation = { getCurrentPosition: success => success(browserPosition({ latitude: 18.5 })) };
  const result = await getCurrentLocation();
  assert.equal(result.origenCaptura, "TELEGRAM_MINI_APP");
  assert.equal(result.latitud, 18.5);
});
