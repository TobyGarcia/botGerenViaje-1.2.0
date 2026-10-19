import test from "node:test";
import assert from "node:assert/strict";
import {
  urlBase64ToUint8Array,
  isPushNotificationSupported,
  getPushNotificationPermission
} from "../src/services/push-notifications.js";

test("urlBase64ToUint8Array convierte correctamente una clave VAPID pública", () => {
  const sampleVapidKey = "BNr9gTA6gHpiohPRFzViPWU6KHAKK9Rrbne-5JRNpKoLGksfWOhs-TLlAbyik2v0n-2TxpITF9SNFs0DigX6L1E";
  const result = urlBase64ToUint8Array(sampleVapidKey);

  assert.ok(result instanceof Uint8Array, "El resultado debe ser una instancia de Uint8Array");
  assert.equal(result.length, 65, "Una clave pública VAPID P-256 sin comprimir decodifica exactamente a 65 bytes");
});

test("maneja cadenas vacías o nulas sin lanzar error", () => {
  const empty = urlBase64ToUint8Array("");
  assert.equal(empty.length, 0);

  const nil = urlBase64ToUint8Array(null);
  assert.equal(nil.length, 0);
});

test("isPushNotificationSupported retorna false en entorno Node sin window", () => {
  assert.equal(isPushNotificationSupported(), false);
  assert.equal(getPushNotificationPermission(), "unsupported");
});
