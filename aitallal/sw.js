// AIT ALLAL GROUPE — Service Worker
// CACHE_NAME bumpé à chaque déploiement pour forcer la mise à jour
const CACHE_NAME = 'aitallal-v53-fix122';
const URLS_A_CACHER = [
  './',
  './index.html',
  './manifest.json',
];

// Installation : pré-cache l'app
self.addEventListener('install', (event) => {
  console.log('[SW] Installation', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_A_CACHER))
      .then(() => self.skipWaiting())  // active immédiatement la nouvelle version
  );
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())  // prend le contrôle des onglets ouverts
  );
});

// Fetch : stratégie "Network First" pour le HTML, "Cache First" pour le reste
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ne pas mettre en cache les requêtes Firebase, Google APIs, etc.
  // v53-fix122 : ajout de firebasedatabase.app (Realtime DB europe-west1) et
  // firebasestorage.app — ils manquaient : le repli long-polling de la base
  // pouvait être servi depuis le cache par la branche « Cache First » ci-dessous.
  if (url.includes('firebaseio.com') ||
      url.includes('firebasedatabase.app') ||
      url.includes('firebasestorage.app') ||
      url.includes('googleapis.com') ||
      url.includes('firebase.google.com') ||
      url.includes('gstatic.com')) {
    return;  // laisse passer normalement, pas d'intervention SW
  }

  // HTML : Network First (toujours essayer le réseau pour avoir la dernière version)
  if (event.request.mode === 'navigate' ||
      (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Mettre en cache la réponse fraîche
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Autres ressources : Cache First (rapide, fonctionne offline)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache only successful GETs
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
