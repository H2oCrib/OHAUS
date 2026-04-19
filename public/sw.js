// Minimal service worker — required to satisfy browser PWA installability.
// Intentionally passthrough; caching strategy is out of scope for the desktop-install feature.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op — let the network handle every request.
});
