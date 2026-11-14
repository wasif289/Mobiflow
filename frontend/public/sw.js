const STATIC = "mf-static-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(["/offline.html", "/icons/icon-192.png"])),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)),
        ),
      ),
  );
});
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // likhne wali requests aur doosri sites ko kabhi nahi chhoona
  if (url.pathname.startsWith("/api/")) return; // private data: hamesha seedha network

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  if (req.mode === "navigate") {
    // pages: pehle network, na ho to offline page
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});
