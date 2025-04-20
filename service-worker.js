// --- START OF FILE service-worker.js ---

const CACHE_NAME = 'tree-data-cache-v1'; // Cache version - change this to update cache
const urlsToCache = [
  './', // Cache the root URL (often same as index.html)
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.png' // Add any other essential assets like icons
  // Consider adding an 'offline.html' page here later for better offline UX
  // './offline.html'
];

// --- Installation Event ---
// Cache the core application shell files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil( // Ensures installation waits until cache is populated
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        // Use addAll for atomic caching of essential files
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete, app shell cached.');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] App shell caching failed:', error);
      })
  );
});

// --- Activation Event ---
// Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete caches that are not the current cache name
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete, old caches deleted.');
      // Tell the active service worker to take control of the page immediately.
      return self.clients.claim();
    })
  );
});

// --- Fetch Event ---
// Intercept network requests. Apply a Cache-first strategy,
// dynamically caching successful network responses for future offline use.
self.addEventListener('fetch', event => {
  // We only want to intercept GET requests for caching.
  // Other methods like POST should bypass the cache.
  if (event.request.method !== 'GET') {
    // console.log('[Service Worker] Skipping non-GET request:', event.request.method, event.request.url);
    return; // Let the browser handle non-GET requests directly.
  }

  // console.log('[Service Worker] Handling fetch event for:', event.request.url);
  event.respondWith(
    caches.match(event.request) // 1. Check if the request exists in the cache.
      .then(cachedResponse => {
        // 2. Cache hit - return the cached response.
        if (cachedResponse) {
          // console.log('[Service Worker] Cache hit for:', event.request.url);
          return cachedResponse;
        }

        // 3. Cache miss - go to the network.
        // console.log('[Service Worker] Cache miss, fetching from network:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // 4. Network fetch successful.
            // Check if we received a valid response (status 200 OK).
            if (networkResponse && networkResponse.ok) {
              // console.log('[Service Worker] Network fetch successful, caching new resource:', event.request.url);

              // IMPORTANT: Clone the response. A response is a stream
              // and because we want the browser to consume the response
              // as well as the cache consuming the response, we need
              // to clone it so we have two streams.
              const responseToCache = networkResponse.clone();

              // Open the cache and add the new network response.
              caches.open(CACHE_NAME)
                .then(cache => {
                  // cache.put() stores the response under the request key.
                  cache.put(event.request, responseToCache)
                    .catch(err => {
                        // Log errors during cache.put, e.g., storage quota exceeded
                        console.error('[Service Worker] Failed to cache resource:', event.request.url, err);
                    });
                });
            } else {
                // Log if the network response was not OK (e.g., 404, 500)
                // console.log('[Service Worker] Network response not OK, not caching:', event.request.url, networkResponse ? networkResponse.status : 'No Response');
            }

            // Return the original network response to the browser, regardless of whether it was cached.
            return networkResponse;
          })
          .catch(error => {
            // 5. Network fetch failed (likely offline or server error).
            console.error('[Service Worker] Network fetch failed:', event.request.url, error);
            // At this point, the request is not in the cache and the network failed.
            // We don't have an offline fallback configured yet, so the browser
            // will show its default offline error page.
            // To add fallback later: return caches.match('./offline.html');
            // Re-throwing the error ensures the browser fetch promise rejects correctly.
            throw error;
          });
      })
  );
});

// --- END OF FILE service-worker.js ---
