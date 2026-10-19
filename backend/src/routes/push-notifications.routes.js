import { Router } from "express";
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushNotification,
  notifyUser
} from "../services/push-notifications.service.js";

const router = Router();

// Obtener la llave pública VAPID para que el cliente frontend pueda suscribirse
router.get("/public-key", (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(500).json({
      success: false,
      message: "Las llaves VAPID no están disponibles en el servidor."
    });
  }

  return res.status(200).json({
    success: true,
    publicKey
  });
});

// Registrar o actualizar suscripción Web Push
router.post("/subscribe", async (req, res) => {
  try {
    const { subscription, userType = "conductor", userId = null, userName = null } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({
        success: false,
        message: "Estructura de PushSubscription inválida. Se requiere endpoint y keys (p256dh, auth)."
      });
    }

    const userAgent = req.headers["user-agent"] || null;

    const saved = await saveSubscription({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userType,
      userId,
      userName,
      userAgent
    });

    return res.status(201).json({
      success: true,
      message: "Suscripción a notificaciones push guardada correctamente.",
      data: saved
    });
  } catch (error) {
    console.error("[PushRoutes] Error al guardar suscripción:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo guardar la suscripción push: " + error.message
    });
  }
});

// Desactivar suscripción
router.post("/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Endpoint es requerido para cancelar la suscripción."
      });
    }

    const removed = await removeSubscription({ endpoint });
    return res.status(200).json({
      success: true,
      message: removed ? "Suscripción desactivada." : "Suscripción no encontrada."
    });
  } catch (error) {
    console.error("[PushRoutes] Error al cancelar suscripción:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cancelar suscripción: " + error.message
    });
  }
});

// Enviar notificación de prueba
router.post("/test", async (req, res) => {
  try {
    const { endpoint, keys, userId, userType = "conductor", title, body } = req.body;

    const payload = {
      title: title || "Notificación de Prueba 🔔",
      body: body || "Las notificaciones Web Push están funcionando correctamente en tu dispositivo.",
      url: "./",
      tag: "test-notification-" + Date.now(),
      actions: [{ action: "ver", title: "Entendido" }]
    };

    // Si se envía endpoint directo (prueba inmediata al activar)
    if (endpoint && keys) {
      const result = await sendPushNotification({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, payload);
      return res.status(200).json({
        success: result.success,
        message: result.success ? "Notificación de prueba enviada." : "Error enviando notificación push.",
        detail: result
      });
    }

    // Si se envía por usuario
    if (userId) {
      const result = await notifyUser({
        userType,
        userId,
        ...payload
      });
      return res.status(200).json({
        success: result.sent > 0,
        message: `Notificaciones enviadas: ${result.sent}, fallidas: ${result.failed}`,
        detail: result
      });
    }

    return res.status(400).json({
      success: false,
      message: "Debe proporcionar endpoint+keys o userId para probar la notificación."
    });
  } catch (error) {
    console.error("[PushRoutes] Error en envío de prueba:", error);
    return res.status(500).json({
      success: false,
      message: "Error en prueba de notificación: " + error.message
    });
  }
});

export default router;
