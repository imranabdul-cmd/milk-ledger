// High-performance Network-First Service Worker for PWA
// Guarantees user ALWAYS gets the latest fresh dashboard, with offline fallback
const CACHE_NAME = 'family-milk-v5-realtime';

const STATIC_FALLBACK_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// 1. Install Event: Cache fallback shell and skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FALLBACK_ASSETS);
    })
  );
});

// 2. Activate Event: Immediately purge all older obsolete caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event:
// - API calls: ALWAYS bypass service worker (direct network)
// - Navigation / HTML: ALWAYS Network-First so updates show up immediately without hard refresh
// - Static assets (hashed JS/CSS): Cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. All API requests bypass SW completely for live real-time data
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // B. HTML / Navigation Requests: NETWORK-FIRST!
  // This completely eliminates stale cache: every visit, login, or back-button gets fresh HTML!
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback only when network is completely unavailable
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // C. Static Assets with Vite Content Hashes (/assets/*): Cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
