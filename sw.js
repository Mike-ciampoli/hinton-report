/* Offline support: keeps a copy of the app on the device.
   Bump VERSION (and js/version.js) for every update so phones pick it up.
   CORE files must all download or the update is skipped (the old copy keeps
   working). EXTRA files (fonts, icons) are saved when they can be; if one is
   missing the app still works offline with the phone's own fonts. */
const VERSION = '2.0.0';
const CACHE = 'hinton-water-' + VERSION;
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'js/version.js', 'js/store.js', 'js/app.js'
];
const EXTRA = [
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png',
  'fonts/barlow-latin-400-normal.woff2', 'fonts/barlow-latin-500-normal.woff2',
  'fonts/barlow-latin-600-normal.woff2', 'fonts/barlow-latin-700-normal.woff2',
  'fonts/barlow-semi-condensed-latin-600-normal.woff2', 'fonts/barlow-semi-condensed-latin-700-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE.map(f => new Request(f, { cache: 'reload' })));
    await Promise.all(EXTRA.map(f => fetch(new Request(f, { cache: 'reload' })).then(r => (r.ok ? c.put(f, r) : null)).catch(() => null)));
  }));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hinton-water-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }
  /* Cached copy first. Offline and not cached (say, a missing font): answer
     with an empty 404 so the page falls back quietly instead of erroring. */
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).catch(() => new Response('', { status: 404, statusText: 'offline' }))));
});

