const CACHE_NAME = 'family-tree-v1';

// Initial assets to cache on install (the core shell)
const PRECACHE_ASSETS = [
  '/family-tree/',
  '/family-tree/index.html',
  '/family-tree/manifest.json',
  '/family-tree/favicon.ico',
  '/family-tree/favicon.svg',
  '/family-tree/icon-192.png',
  '/family-tree/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignore cache errors during installation for robustness
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache warning: some resources could not be cached on install', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. For HTML/Document requests (the main page), use Network-First, fallback to Cache
  if (event.request.mode === 'navigate' || url.pathname === '/family-tree/' || url.pathname === '/family-tree/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match('/family-tree/')
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return caches.match('/family-tree/index.html');
            });
        })
    );
    return;
  }

  // 2. For static assets (JS, CSS, Images, Fonts, JSON), use Cache-First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache successful responses or opaque (third-party) requests like Google Fonts
        if (response.status === 200 || response.status === 0) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch((err) => {
        console.error('Fetch failed for asset:', event.request.url, err);
      });
    })
  );
});
