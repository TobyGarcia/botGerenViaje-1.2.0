import safeStorage from "../utils/safeStorage.js";

// Convierte la clave VAPID pública en base64url a un Uint8Array para pushManager
export function urlBase64ToUint8Array(base64String) {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const atobFn = typeof atob === "function"
    ? atob
    : (typeof window !== "undefined" && window.atob) || ((str) => Buffer.from(str, "base64").toString("binary"));
  const rawData = atobFn(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported() {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushNotificationPermission() {
  if (!isPushNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function fetchVapidPublicKey() {
  const response = await fetch("/api/push/public-key");
  if (!response.ok) {
    throw new Error(`Error obteniendo clave pública VAPID: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success || !json.publicKey) {
    throw new Error(json.message || "No se recibió la clave pública VAPID.");
  }
  return json.publicKey;
}

export async function getActiveSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn("[PushService] Error consultando suscripción existente:", err);
    return null;
  }
}

export async function subscribeToWebPush({
  userType = "conductor",
  userId = null,
  userName = null
} = {}) {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      reason: "UNSUPPORTED",
      message: "Tu navegador o dispositivo no soporta notificaciones Web Push."
    };
  }

  // Solicitar permiso de notificaciones al usuario
  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      success: false,
      reason: "DENIED",
      message: "Permiso de notificaciones denegado en el navegador."
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicKey = await fetchVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    const subJson = subscription.toJSON();

    // Guardar en el backend
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth
          }
        },
        userType,
        userId: userId ? String(userId) : null,
        userName
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Error al registrar la suscripción en el servidor.");
    }

    safeStorage.setItem("push_notifications_enabled", "true");
    return {
      success: true,
      subscription,
      message: "Notificaciones activadas exitosamente."
    };
  } catch (err) {
    console.error("[PushService] Fallo al suscribir a push:", err);
    return {
      success: false,
      reason: "ERROR",
      message: err.message || "No se pudo activar las notificaciones."
    };
  }
}

export async function unsubscribeFromWebPush() {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const subscription = await getActiveSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notificar al backend
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
      }).catch(() => {});
    }

    safeStorage.removeItem("push_notifications_enabled");
    return { success: true, message: "Notificaciones desactivadas." };
  } catch (err) {
    console.warn("[PushService] Error al desuscribir:", err);
    return { success: false, message: err.message };
  }
}

export async function sendTestWebPushNotification({ userType = "conductor", userId = null } = {}) {
  try {
    const subscription = await getActiveSubscription();
    const subJson = subscription?.toJSON();

    const body = subJson?.endpoint && subJson?.keys
      ? {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          title: "¡Notificación Recibida! 🔔",
          body: "El sistema de alertas Web Push de AQUARIO está conectado y activo en este equipo."
        }
      : {
          userType,
          userId,
          title: "¡Notificación Recibida! 🔔",
          body: "El sistema de alertas Web Push de AQUARIO está conectado y activo en este equipo."
        };

    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[PushService] Error enviando prueba:", err);
    return { success: false, message: err.message };
  }
}
