/* Bump VERSION whenever any shell resource changes. Never cache user data. */
const VERSION = 'v0.2.0';
const PREFIX = 'topkiller-pocket-shell-';
const CACHE = PREFIX + VERSION;
const BASE = '/topkiller_pocket/';
const ASSETS = [BASE, ...[
  'index.html', 'styles.css', 'js/app.js', 'js/math.js', 'js/settings.js',
  'js/pwa.js', 'manifest.webmanifest', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/apple-touch-icon.png',
].map(path => BASE + path)];
self.addEventListener('install', event => {
  // A failed download must leave the previously active version intact.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
  // Use normal waiting: open pages keep a coherent shell until all are closed.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys())
      .filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.pathname.startsWith(BASE)) return;
  const navigation = event.request.mode === 'navigate';
  if (!navigation && (url.search || !ASSETS.includes(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Serve a single version of HTML and modules, including while online.
    const cached = await cache.match(navigation ? BASE : url.pathname);
    return cached || fetch(event.request);
  })());
});
