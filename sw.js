/* Service Worker – Offline-Cache für den ADT Trainer.
 *
 * Strategie (selbst-aktualisierend, KEIN manuelles Hochzählen je Release nötig):
 *  - App-Shell (HTML, CSS, JS, Icons, Manifest): stale-while-revalidate –
 *    sofort aus dem Cache, im Hintergrund frisch nachladen → neue Version ist beim
 *    nächsten Start automatisch da. Eine Shell-Generation ist immer in sich stimmig.
 *  - config.js & questions.js: network-first (mit Timeout) – Konfig-/Fragen-Updates
 *    (z. B. korrigierte Antworten) erreichen die Nutzer sofort, sobald online.
 *  - offline: alles kommt aus dem Cache.
 *
 * Der Cache-Name ist stabil; NICHT je Release ändern. Nur bei strukturellen
 * Änderungen der Caching-Logik erhöhen (dann wird der alte Cache in „activate" geleert). */
const CACHE = "adt-shell-v1";

/* WARUM DIESE ZEILE: Der Browser meldet eine neue Fassung nur, wenn sich sw.js SELBST
 * ändert – dann feuert `updatefound` und die App zeigt ihr Update-Banner. Ändert sich
 * nur app.js/css/questions.js, bleibt sw.js byte-gleich und es kommt KEIN Hinweis; die
 * neue Fassung erscheint dann irgendwann still beim übernächsten Start.
 * Genau das war zwischen v0.20.0 und v0.44.0 der Fall: sw.js lag unverändert, also gab
 * es monatelang keinen automatischen Hinweis mehr.
 * Deshalb wird hier bei JEDEM Release die App-Version mitgeführt. Sie muss mit
 * APP_VERSION in js/app.js übereinstimmen – ein Test wacht darüber. */
const SW_APP_VERSION = "0.45.0";
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
  // Toleranter Precache: jede Datei einzeln – eine fehlende Datei darf NICHT die
  // ganze Installation (und damit Offline) scheitern lassen (addAll wäre all-or-nothing).
  // `cache: "reload"` umgeht den HTTP-Cache: Sonst könnte eine gerade bestätigte
  // Aktualisierung die ALTE app.js in den Cache legen und der Neustart zeigte weiter
  // die alte Fassung. Weiterhin je Datei tolerant – eine fehlende darf Offline nicht kippen.
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" }))
      .catch(() => c.add(u).catch((err) => console.warn("Precache übersprungen:", u, err)))))
  ));
});

/* ---- Aktualisierung auf Zuruf („Nach Updates suchen") ----
 * Die App-Shell hält sich zwar per stale-while-revalidate selbst aktuell, aber immer erst
 * für den NÄCHSTEN Start – und auf dem iPhone bleibt eine Home-Bildschirm-App gerne tagelang
 * im Hintergrund. Damit man eine neue Version nicht durch Neuinstallieren erzwingen muss,
 * lädt der Service Worker hier auf Zuruf alle Shell-Dateien frisch aus dem Netz in den Cache.
 * Der Umweg über den Service Worker ist nötig: Ein `fetch` aus der Seite heraus liefe erneut
 * durch dessen fetch-Handler und bekäme genau die alte Kopie aus dem Cache zurück.
 * Antwort: { ok, version } – `version` ist die AUSGELIEFERTE App-Version (aus js/app.js). */
// Bewusst an die DEKLARATION gebunden (Zeilenanfang + const): Ein Kommentar, der den Namen
// nur erwähnt, darf die Erkennung nicht kapern.
function versionFromAppJs(text) {
  const m = /^\s*const APP_VERSION\s*=\s*"([^"]+)"/m.exec(text || "");
  return m ? m[1] : "";
}
async function refreshShell() {
  const cache = await caches.open(CACHE);
  let version = "";
  // Einzeln und fehlertolerant: eine nicht erreichbare Datei darf den Rest nicht verhindern.
  await Promise.all(ASSETS.map(async (u) => {
    try {
      const res = await fetch(new Request(u, { cache: "reload" }));   // echtes Netz, kein HTTP-Cache
      if (!cacheable(res)) return;
      if (/js\/app\.js$/.test(u)) version = versionFromAppJs(await res.clone().text());
      await cache.put(u, res);
    } catch (err) { console.warn("Update: Datei übersprungen", u, err); }
  }));
  return version;
}

self.addEventListener("message", (e) => {
  if (!e.data) return;
  if (e.data.type === "SKIP_WAITING") self.skipWaiting();
  if (e.data.type === "REFRESH_SHELL") {
    const port = e.ports && e.ports[0];
    const reply = (payload) => { try { if (port) port.postMessage(payload); } catch (_) {} };
    e.waitUntil(refreshShell().then(
      (v) => reply({ ok: true, version: v }),
      (err) => reply({ ok: false, error: String((err && err.message) || err) })
    ));
  }
});

// ---- Web Push: eingehende Benachrichtigung anzeigen ----
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "ADT Trainer";
  const options = {
    body: data.body || "Zeit für ein paar Übungsfragen! 📚",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.tag || "adt-reminder",
    data: { url: data.url || "./index.html" },
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ---- Klick auf die Benachrichtigung: App fokussieren/öffnen ----
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function cacheable(res) { return res && res.status === 200 && res.type === "basic"; }
function putInCache(req, res) {
  if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
}
// Netzwerk mit Timeout: bei „lie-fi" (Netz da, aber lahm) nicht ewig hängen,
// sondern nach kurzer Zeit auf den Cache zurückfallen.
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => { ctrl.abort(); reject(new Error("timeout")); }, ms);
    // cache:"no-cache" umgeht den HTTP-Cache des Browsers (bedingter Request) – sonst
    // könnte eine „frische" Antwort in Wahrheit veraltet aus dem HTTP-Cache kommen.
    fetch(request, { signal: ctrl.signal, cache: "no-cache" }).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}
// Stale-while-revalidate: sofort aus dem Cache antworten und im Hintergrund
// aktualisieren. Ohne Cache-Treffer normal aus dem Netz laden (und cachen).
// Die Revalidierung umgeht den HTTP-Cache (no-cache), damit wirklich die neue Datei kommt.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request, { cache: "no-cache" }).then((res) => {
        if (cacheable(res)) cache.put(request, res.clone());
        return res;
      }).catch(() => cached);           // offline: Cache-Kopie behalten
      return cached || network;         // Treffer sofort, sonst aufs Netz warten
    })
  );
}
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // Fremd-Hosts (z. B. Supabase) nie cachen

  const networkFirst = e.request.mode === "navigate"
    || url.pathname.endsWith("/config.js")
    || url.pathname.endsWith("/questions.js");

  if (networkFirst) {
    e.respondWith(
      fetchWithTimeout(e.request, 3500).then((res) => { putInCache(e.request, res); return res; })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
    );
  } else {
    e.respondWith(staleWhileRevalidate(e.request));
  }
});
