// Mindora service worker — network-first so new deploys show up immediately.
// Bump CACHE_VERSION whenever you want to force-clear old caches.
const CACHE_VERSION = 'mindora-v1';
const CORE = ['./', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(CORE).catch(()=>{})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache Supabase / API calls — always go to the network.
  if (url.origin !== self.location.origin) return;

  // Network-first for same-origin app files; fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
