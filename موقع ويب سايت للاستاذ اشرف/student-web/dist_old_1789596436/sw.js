// Self-destroying Service Worker
// Installed to kill and unregister the old 'sw.js' service worker that was caching poisoned assets.

self.addEventListener('install', function (event) {
  console.log('[SW] Self-destroying Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  console.log('[SW] Self-destroying Service Worker activating. Purging caches and unregistering...');
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.registration.unregister();
    }).then(function () {
      console.log('[SW] Unregistration complete. Reloading clients...');
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (clients) {
      clients.forEach(function (client) {
        if (client.navigate && client.url) {
          client.navigate(client.url).catch(function () {});
        }
      });
    })
  );
});

// Immediately pass through all fetch requests during destruction to avoid blocking the page
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
