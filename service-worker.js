// --- START OF FILE service-worker.js ---

const CACHE_NAME = 'tree-data-cache-v1'; // Cache version - change this to update cache
const urlsToCache = [
  './', // Cache the root URL (often same as index.html)
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.png' // Add any other essential assets like icons
];

// --- Installation Event ---
// Cache the core application shell files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil( // Ensures installation waits until cache is populated
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting(); // Activate immediately after install (optional but often useful)
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
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
          if (cacheName !== CACHE_NAME) { // If it's an old cache
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete, claiming clients...');
      return self.clients.claim(); // Take control of uncontrolled clients (open tabs)
    })
  );
});

// --- Fetch Event ---
// Intercept network requests and serve from cache if offline (Cache First Strategy)
self.addEventListener('fetch', event => {
  // console.log('[Service Worker] Fetching:', event.request.url);
  event.respondWith(
    caches.match(event.request) // Check if the request is in the cache
      .then(response => {
        // If found in cache, return the cached response
        if (response) {
          // console.log('[Service Worker] Found in cache:', event.request.url);
          return response;
        }
        // If not in cache, fetch from the network
        // console.log('[Service Worker] Not in cache, fetching from network:', event.request.url);
        return fetch(event.request);
        // Optional: You could add logic here to cache dynamic requests if needed,
        // but for a simple app shell, this is often sufficient.
      })
      .catch(error => {
        // Handle fetch errors (e.g., network offline and not in cache)
        console.error('[Service Worker] Fetch error:', error);
        // You could potentially return a custom offline fallback page here if desired
        // For now, just let the standard browser offline error show
      })
  );
});

// --- END OF FILE service-worker.js ---
