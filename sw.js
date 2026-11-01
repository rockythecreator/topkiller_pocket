/* Bump VERSION whenever any shell resource changes. Never cache user data. */
const VERSION = 'v0.3.0';
const PREFIX = 'topkiller-pocket-shell-';
const CACHE = PREFIX + VERSION;
const BASE = '/topkiller_pocket/';
const ASSETS = [BASE, ...[
  'index.html', 'styles.css', 'js/app.js', 'js/math.js', 'js/settings.js',
  'js/pwa.js', 'js/mc-rng.js', 'js/monte-carlo.js', 'js/mc-statistics.js',
  'js/mc-worker.js', 'js/mc-ui.js', 'manifest.webmanifest', 'icons/icon-192.png',
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

// Only the active worker audits its own shell. Never repair from a different release.
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const url of ASSETS) {
      const response = await cache.match(url);
      if (!response?.ok) missing.push(url);
    }
    try {
      if (missing.length) {
        const worker = await fetch(new Request(BASE + 'sw.js', { cache: 'no-store' }));
        if (!worker.ok || !(await worker.text()).includes("const VERSION = '" + VERSION + "';")) {
          throw new Error('Release diversa: attendere aggiornamento completo');
        }
        // addAll rejects failed responses; existing entries are left untouched.
        await cache.addAll(missing.map(url => new Request(url, { cache: 'reload' })));
      }
      for (const url of ASSETS) {
        if (!(await cache.match(url))?.ok) throw new Error('Cache incompleta');
      }
      event.ports[0].postMessage({ ready: true });
    } catch {
      event.ports[0].postMessage({ ready: false });
    }
  })());
});
