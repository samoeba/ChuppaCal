/* Only the generic offline shell is cached; authenticated pages and API responses never enter Cache Storage. */
const CACHE_NAME = "chuppacal-offline-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["/offline.html", "/offline.js"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("chuppacal-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key))))]));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !/^\/(today|calendar|chores|meals|lists|settings)(\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.open(CACHE_NAME)).match("/offline.html")));
});
