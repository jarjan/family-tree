// Bump the version whenever the caching strategy or precache list changes.
const CACHE_NAME = 'family-tree-v2';
const BASE = '/family-tree/';

// Initial assets to cache on install (the core shell)
const PRECACHE_ASSETS = [
  BASE,
  `${BASE}manifest.json`,
  `${BASE}favicon.ico`,
  `${BASE}favicon.svg`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}apple-touch-icon.png`
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
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

// Network first, falling back to the cache when offline.
function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() =>
      caches.match(request)
        .then((cached) => cached || (fallbackUrl && caches.match(fallbackUrl)))
        .then((cached) => cached || Response.error())
    );
}

// Cache first; only safe for files whose URL changes when their content does.
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request)
      .then((response) => putInCache(request, response))
      .catch(() => Response.error());
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Leave third-party requests (e.g. Google Fonts) to the browser's HTTP cache.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, BASE));
  } else if (url.pathname.startsWith(`${BASE}_astro/`)) {
    // Astro build output has content-hashed filenames
    event.respondWith(cacheFirst(request));
  } else {
    // manifest, icons and other unhashed files: keep them fresh
    event.respondWith(networkFirst(request));
  }
});
