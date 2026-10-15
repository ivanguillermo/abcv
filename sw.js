const CACHE_NAME = 'bcv-pwa-v3';
const STATIC_ASSETS = [
  './', './index.html', './app.js', './style.css', './manifest.json',
  './mitasa.png', './bs_dol_peq.png', './bs_dol_g.png', './euro.png'
];

// Cada archivo se guarda por separado: si falta uno (p. ej. una imagen) los demás igual se cachean
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Red primero (así siempre ves la última versión) y caché si no hay conexión.
// Las llamadas a Google Apps Script (otro origen) no pasan por aquí.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
