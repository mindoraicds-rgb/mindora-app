/* Mindora service worker — Stage 37
   Purpose: let the app OPEN with no signal. It caches the shell (the page
   itself and the Supabase JS library from the CDN). Everything else —
   Supabase API calls, image storage — goes to the network as normal; those
   are handled by the app's own offline queue (IndexedDB), not by this cache.

   Cache strategy:
   - Navigations (opening the app): network-first, fall back to the cached
     shell when offline, so a dropped connection still loads the interface.
   - The Supabase JS CDN script: cache-first (it's versioned and static).
   - Everything else: pass through to the network untouched.
*/
const CACHE = 'mindora-shell-v1';
const SHELL = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes
  const url = new URL(req.url);

  // Supabase API and storage always go to the network (the app queues its own
  // writes offline). Do not cache these.
  if (url.hostname.endsWith('supabase.co')) return;

  // The Supabase JS library from the CDN: serve from cache if present.
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // App navigations: network-first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Same-origin static assets: cache-first with network fallback.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
  }
});
