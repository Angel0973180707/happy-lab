// happy-lab v0.3.2 service worker
const CACHE_NAME = "happy-lab-v0.3.2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        // runtime cache (basic)
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>cached);
    })
  );
});
