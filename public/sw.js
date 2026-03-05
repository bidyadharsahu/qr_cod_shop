// Netrik XR Shop - Service Worker v3
// Provides offline caching while NEVER interfering with Supabase/real-time

const CACHE_NAME = 'netrikxr-v3';
const DYNAMIC_CACHE = 'netrikxr-dynamic-v3';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/manifest.json',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Helper: check if a URL should NEVER be handled by the service worker
function shouldBypass(request) {
  const url = new URL(request.url);

  // 1. NEVER touch non-GET requests (POST, PATCH, DELETE = Supabase mutations)
  if (request.method !== 'GET') return true;

  // 2. NEVER touch Supabase (REST, Realtime, WebSocket, Auth, Storage)
  if (url.hostname.includes('supabase')) return true;

  // 3. NEVER touch WebSocket upgrade requests
  if (request.headers.get('Upgrade') === 'websocket') return true;

  // 4. NEVER touch chrome-extension or non-http(s) protocols
  if (!url.protocol.startsWith('http')) return true;

  // 5. NEVER touch API routes (Next.js API endpoints if any)
  if (url.pathname.startsWith('/api/')) return true;

  // 6. NEVER touch _next/data (Next.js data fetching for dynamic pages)
  if (url.pathname.startsWith('/_next/data/')) return true;

  return false;
}

// Fetch strategy: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Bypass everything that should go straight to network
  if (shouldBypass(event.request)) return;

  const { request } = event;
  const url = new URL(request.url);

  // For navigation to /order without a table param, inject table from cookie
  if (request.mode === 'navigate' && url.pathname === '/order' && !url.searchParams.has('table')) {
    const cookieHeader = request.headers.get('cookie') || '';
    const tableMatch = cookieHeader.match(/(?:^|;\s*)netrikxr-table=([^;]*)/);
    if (tableMatch) {
      const table = decodeURIComponent(tableMatch[1]);
      const redirectUrl = new URL(url);
      redirectUrl.searchParams.set('table', table);
      event.respondWith(Response.redirect(redirectUrl.toString(), 302));
      return;
    }
  }

  // For navigation requests (page loads) - network first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const cloned = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // For static assets (_next/static) - cache first (immutable hashed files)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
      })
    );
    return;
  }

  // For images and icons - stale while revalidate
  if (request.destination === 'image' || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notification support (for future use - order updates)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Your order has been updated!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/order',
    },
    actions: [
      { action: 'open', title: 'View Order' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Netrik XR Shop', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/order';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
