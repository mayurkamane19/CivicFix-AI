/**
 * CivicFix AI - Progressive Web App Service Worker
 * Cache Strategy:
 *  - App Shell / Static Assets: Cache-First with Network Fallback
 *  - Navigation (HTML): Network-First with Offline Page Fallback
 *  - APIs (/api/*): Strict Network-Only (NEVER cache sensitive citizen or auth data!)
 */

const CACHE_VERSION = 'civicfix-shell-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg'
];

// Install Event — Precaches application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache incomplete (offline fallback preserved):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Purges obsolete cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Purging obsolete cache version:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Implements secure, non-leaking caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Security Guard: NEVER cache or intercept non-GET requests (mutations)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Security Guard: NEVER cache backend API requests (/api/*)
  // Protected complaints, JWT tokens, and user credentials must NEVER be stored in SW cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You are currently offline. Please check your internet connection.',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 3. Navigation Requests (Page Loads / SPA entry points)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;

          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('Offline - CivicFix AI', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // 4. Static Assets (JS, CSS, Web Fonts, Images, Leaflet Tiles)
  // Cache-First strategy with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate for background freshness of assets
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
        return response;
      });
    })
  );
});

// Push Notification Event Listener
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'CivicFix AI Update', message: event.data.text() };
    }
  }

  const title = data.title || 'CivicFix AI Notification';
  const options = {
    body: data.message || data.body || 'New municipal update on your civic report.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || (data.complaintId ? `/api/complaints/track/${data.complaintId}` : '/'),
      complaintId: data.complaintId || null,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'View Update' },
      { action: 'dismiss', title: 'Close' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Push Notification Click Event Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new browser window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message listener (for SKIP_WAITING or client communication)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
