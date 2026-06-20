const CACHE_NAME = 'yeedem-books-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa_icon_logo.png'
];

// Install event: cache initial offline shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching offline shell assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Pruning stale cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: handle offline routing with a robust strategy
self.addEventListener('fetch', (event) => {
  // Only intercept simple HTTP/HTTPS GET requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Exclude API requests from service worker caching to ensure authentic real-time reads
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-First with Cache-Fallback strategy for HTML, JS, CSS, and other assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the network response is valid, clone and cache it dynamically
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline), attempt to serve from local service worker cache
        console.log('[Service Worker] Network unreachable, serving cached asset:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the page request failed and it's navigation, return cached root/index shell
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
