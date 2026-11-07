
const CACHE = "no-comment-v7";

const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./cards.json",
  "./manifest.webmanifest",
  "./assets/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("no-comment-") && key !== CACHE
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  const isCardsFile = url.pathname.endsWith("/cards.json");

  if (isCardsFile) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE).then(cache => {
              cache.put(event.request, copy);
            });
          }

          return response;
        })
        .catch(() => caches.match(event.request))
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE).then(cache => {
              cache.put(event.request, copy);
            });
          }

          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return Response.error();
        })
    })
  );
});
