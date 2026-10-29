/* Routag service worker: offline-first shell, network-first pages so updates arrive.
   Bump VERSION whenever a cached file changes in a way that must reach installed apps. */
const VERSION = 'routag-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Pages (/, /rider-rush, /?play=quiz ...): try the network, fall back to the cached app.
  if (req.mode === 'navigate') {
    const isApp = ['/', '/index.html', '/rider-rush'].includes(url.pathname);
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && isApp) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Everything else: serve from cache instantly, refresh it in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
