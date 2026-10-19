import test from "node:test";
import assert from "node:assert/strict";
import { getVapidPublicKey } from "../services/push-notifications.service.js";

test("obtiene llave pública VAPID válida en formato Base64URL", () => {
  const publicKey = getVapidPublicKey();
  assert.ok(typeof publicKey === "string", "La llave pública debe ser una cadena");
  assert.ok(publicKey.length > 50, "La llave pública VAPID debe tener longitud suficiente");
});

test("valida estructura requerida para suscripción Web Push", async () => {
  const { saveSubscription } = await import("../services/push-notifications.service.js");
  
  await assert.rejects(
    async () => {
      await saveSubscription({ endpoint: null, keys: null });
    },
    /Datos de suscripción Push incompletos/
  );

  await assert.rejects(
    async () => {
      await saveSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/123", keys: { p256dh: "key" } });
    },
    /Datos de suscripción Push incompletos/
  );
});
