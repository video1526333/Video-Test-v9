const CACHE_NAME = 'video-portal-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  // Add other essential static assets
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate worker immediately
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Remove caches that aren't the current one
          return cacheName.startsWith('video-portal-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('[Service Worker] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim()) // Take control of open pages
  );
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', event => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Don't cache API requests or external resources like HLS.js or CORS proxies
  const apiUrlHostname = 'api.yzzy-api.com';
  const corsProxyHostnames = ['cors-proxy.elfsight.com', 'corsproxy.io', 'cors.eu.org'];
  const externalJsHostnames = ['cdn.jsdelivr.net'];
  const requestUrl = new URL(event.request.url);

  if (requestUrl.hostname === apiUrlHostname ||
      corsProxyHostnames.includes(requestUrl.hostname) ||
      externalJsHostnames.includes(requestUrl.hostname) ||
      requestUrl.pathname.endsWith('.m3u8') || // Don't cache video streams
      requestUrl.search.includes('ac=') // Don't cache API calls by query param
     ) {
    // Go directly to the network for API calls, CORS proxies, external scripts, and video streams
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Don't cache responses that failed or aren't basic
                if (responseToCache.ok && responseToCache.type === 'basic') {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
}); 