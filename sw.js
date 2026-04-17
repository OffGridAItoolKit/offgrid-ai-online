/**
 * OffGrid AI ToolKit - Service Worker
 * Caches static assets (HTML, CSS, JS) for faster repeat visits on slow connections.
 * NEVER caches API responses — all AI chat goes directly to the server.
 * 
 * Strategy: Stale-While-Revalidate for static assets
 * - Serve cached version instantly (fast on slow connections)
 * - Fetch fresh version in background (stays up to date)
 */

const CACHE_VERSION = 'offgrid-v5.4.1';
const STATIC_ASSETS = [
    '/',
    '/online',
    '/offgridai.css',
    '/offgrid-manifest.json'
];

// Install: pre-cache core static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches when a new version deploys
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: stale-while-revalidate for static, network-only for API
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // NEVER cache API calls, SSE streams, or POST requests
    if (url.pathname.startsWith('/api/') || 
        event.request.method !== 'GET' ||
        event.request.headers.get('accept') === 'text/event-stream') {
        return; // Let the browser handle it normally (network-only)
    }
    
    // For static assets: serve from cache, update in background
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Only cache successful responses for same-origin requests
                if (networkResponse.ok && url.origin === self.location.origin) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_VERSION).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Network failed — return cached version or offline fallback
                return cachedResponse;
            });
            
            // Return cached version immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
