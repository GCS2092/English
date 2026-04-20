// ============================================================
// sw.js — CTI English PWA — Service Worker cache-first
// Cache name : cti-anglais-v1
// Stratégie  : Cache First → réseau si absent → fallback offline
// ============================================================

const CACHE = 'cti-anglais-v1';

const STATIC_FILES = [
  '/',
  '/app.html',
  '/index.html',
  '/manifest.json',
  '/sessionState.js',
  '/aiEngine.js',
  '/adaptiveEngine.js',
  '/voiceModule.js',
  '/exportModule.js',
  '/questionPool.js',
  '/app.js',
];

// ─── INSTALL : pré-cacher tous les assets statiques ──────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(STATIC_FILES).catch(err => {
        console.warn('[SW] Certains fichiers non mis en cache :', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE : supprimer les anciens caches ─────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH : Cache First avec fallback réseau ─────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes API Anthropic (toujours réseau)
  if (url.hostname === 'api.anthropic.com') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Ne pas intercepter les requêtes cross-origin non essentielles
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Stratégie Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      // Pas en cache → réseau + mise en cache dynamique
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // Hors ligne et pas en cache → page de fallback
        if (e.request.destination === 'document') {
          return caches.match('/app.html') || caches.match('/index.html');
        }
        return new Response('Ressource non disponible hors ligne.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      });
    })
  );
});