/**
 * Service worker minimal — réseau uniquement (pas de cache de chunks).
 * Remplace d’anciens SW qui provoquaient « module factory is not available » en dev Turbopack.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((name) => caches.delete(name)));
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
