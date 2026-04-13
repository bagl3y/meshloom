// Minimal service worker required for PWA installability.
// No caching — this app is network-dependent. All fetches pass through.

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function () {});
