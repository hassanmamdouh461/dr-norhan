/* Service worker for offline app-shell support (PWA) + Firebase Cloud
 * Messaging background push notifications, merged into a single file
 * because a browser only supports one active service worker per scope.
 *
 * - Cache-first for hashed, immutable /assets/* build files.
 * - Network-first (falling back to the cached shell) for navigations,
 *   so the app still loads while offline.
 * - Old caches are purged on activate so deploys don't leak storage.
 * - Firebase Messaging (compat build, via importScripts) handles push
 *   events that arrive while the app is closed/backgrounded and shows
 *   a system notification for them.
 */

// ── Firebase Cloud Messaging (background push notifications) ──
// Uses the compat/importScripts build because this is a classic
// (non-module) service worker — the modular SDK requires ES modules.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// ⚠️ مشروع Firebase الخارجي — يحتاج ترحيلاً يدوياً عبر Cloudflare/Supabase.
// يجب أن تطابق هذه القيم src/services/firebase.ts؛ تغييرها دون ترحيل المشروع
// بالكامل يقطع إشعارات Push عن الأجهزة المسجَّلة.
firebase.initializeApp({
  apiKey: 'AIzaSyAV8sko2FrZhxu64DXmqm1ZG1eTVVbVUWM',
  authDomain: 'synaptic-3ef0d.firebaseapp.com',
  projectId: 'synaptic-3ef0d',
  storageBucket: 'synaptic-3ef0d.firebasestorage.app',
  messagingSenderId: '633875033612',
  appId: '1:633875033612:web:ed65fa0d99ff5b086fc829',
  measurementId: 'G-NY9CYE8YN8',
});

// Only initialize messaging if the browser actually supports it inside
// this worker context (older browsers dispatching this SW may not).
try {
  const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
  if (messaging) {
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'إشعار جديد';
      const body = (payload.notification && payload.notification.body) || '';
      self.registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: payload.data || {},
      }).catch(() => {});
    });
  }
} catch (err) {
  // Never let FCM setup break the rest of the service worker (offline cache).
  console.error('FCM background messaging setup failed:', err);
}

// Focus/open the app when the user taps a background push notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })()
  );
});

// ── PWA offline app-shell caching ──
// Bumped to v2: a v1 bug could cache an HTML SPA-fallback response under an
// /assets/*.js cache key if that request raced a deploy (see fetch handler
// below for the content-type guard that now prevents this). Bumping the
// version forces every existing client to drop its old, possibly-poisoned
// cache on next activation instead of serving it forever.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `alostaz-walid-${CACHE_VERSION}`;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for hashed, content-addressed build assets (safe to keep forever).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        // Validate cached response: if it was poisoned (text/html stored for a
        // JS/CSS/image asset), discard it and re-fetch from network.
        if (cached) {
          const cachedType = cached.headers.get('content-type') || '';
          if (!cachedType.includes('text/html')) {
            return cached; // Valid cache hit
          }
          // Poisoned entry — purge it
          await cache.delete(request);
        }
        try {
          const response = await fetch(request);
          // A deploy race can make Pages serve the SPA-fallback index.html
          // (still a 200) for an asset URL that isn't live on that edge node
          // yet. Never cache that under the asset's key — a hashed asset
          // response is never text/html, and caching it here would poison
          // this "forever" cache with no way to self-heal on reload.
          const contentType = response.headers.get('content-type') || '';
          if (response && response.ok && !contentType.includes('text/html')) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return Response.error();
        }
      })
    );
    return;
  }

  // Network-first (with cached-shell fallback) for page navigations.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          cache.put(SHELL_URL, response.clone());
          return response;
        } catch {
          const cached = await cache.match(SHELL_URL);
          return cached || Response.error();
        }
      })()
    );
  }
});
