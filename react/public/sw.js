/* Service worker for the FPAMAS dashboard: lets the app open with no
   connection (field capture offline). Captures themselves are queued in
   IndexedDB by the app (src/lib/offlineQueue.ts); this file only caches the
   app's own files.
     - Page loads: network first, fall back to the cached app shell.
     - Built assets (hashed filenames): cache first.
     - Fonts / icon CSS: cached, refreshed in the background.
     - API calls and map tiles: never cached. */
const VERSION = 'fpamas-v1';
const SCOPE = self.registration.scope;               // e.g. https://site/app/
const SHELL = SCOPE + 'index.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isFont = url => /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/.test(url);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (req.mode === 'navigate' && url.startsWith(SCOPE)) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then(c => c.put(SHELL, copy));
      return res;
    }).catch(() => caches.match(SHELL)));
    return;
  }
  if (url.startsWith(SCOPE + 'assets/') || url.startsWith(SCOPE + 'templates/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (isFont(url)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
