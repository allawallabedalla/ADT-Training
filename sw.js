/* Service Worker – Offline-Cache für den ADT Trainer.
 * Cache-Version bei Änderungen erhöhen, damit Nutzer die neue Version erhalten. */
const CACHE = "adt-trainer-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./config.js",
  "./js/sync.js",
  "./js/app.js",
  "./data/questions.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  // KEIN automatisches skipWaiting: ein Update wartet, bis der Nutzer es per
  // In-App-Banner bestätigt (dann sendet die App die SKIP_WAITING-Nachricht).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Strategie:
//  - config.js, questions.js und Navigationen: Network-first (frisch, wenn online;
//    Cache-Fallback offline) – so erreichen Konfig-/Fragen-Updates die Nutzer sofort.
//  - alle übrigen App-Dateien: Cache-first (schnell, offline-fest) mit Nachcachen.
function putInCache(req, res) {
  if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
}
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const networkFirst = e.request.mode === "navigate"
    || url.pathname.endsWith("/config.js")
    || url.pathname.endsWith("/questions.js");

  if (networkFirst) {
    e.respondWith(
      fetch(e.request).then((res) => { putInCache(e.request, res); return res; })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res && res.type === "basic") putInCache(e.request, res);
        return res;
      }).catch(() => caches.match("./index.html")))
    );
  }
});
