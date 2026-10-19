/* global self, clients */
// sw-push-handler.js - Manejador de notificaciones Web Push para Service Worker

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "GV Control de Viajes",
      body: event.data ? event.data.text() : "Nueva notificación de viaje."
    };
  }

  const title = data.title || "GV Control de Viajes";
  const options = {
    body: data.body || "",
    icon: data.icon || "./pwa-192x192.png",
    badge: data.badge || "./favicon.png",
    tag: data.tag || "gv-general-notification",
    renotify: true,
    vibrate: [150, 50, 100],
    data: {
      url: data.url || "./",
      ...(data.data || {})
    },
    actions: Array.isArray(data.actions) && data.actions.length > 0
      ? data.actions
      : [{ action: "open", title: "Abrir App" }]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "./";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si la ventana ya está abierta, traerla al frente
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      // Si está cerrada, abrir una nueva ventana
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
