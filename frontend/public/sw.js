const CACHE_NAME = 'gerenciamiento-viajes-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons.svg',
  'https://telegram.org/js/telegram-web-app.js'
];

// Install: Precaching App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// - API calls (/api/): Network first, fail gracefully if offline
// - Static assets & HTML: Cache first with Network fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Network First for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ offline: true, message: 'Dispositivo sin conexión' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Cache First, fallback to Network for App Shell and Static Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache refresh
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If navigation request fails completely, serve cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
