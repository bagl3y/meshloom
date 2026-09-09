/* Service worker for PWA installability and Web Push notifications. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler — required for PWA installability criteria.
// We don't cache anything; the app always fetches from the network.
self.addEventListener("fetch", () => {});

// Documented as pwa.newMessage. SW cannot import i18next; keep a tiny lookup.
const NEW_MESSAGE_TITLES = {
  fr: "Nouveau message",
  en: "New message",
};

function fallbackNewMessageTitle(language) {
  return NEW_MESSAGE_TITLES[language] || NEW_MESSAGE_TITLES.fr;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: fallbackNewMessageTitle("fr"), body: event.data?.text() || "" };
  }

  const language = data.language === "en" || data.language === "fr" ? data.language : "fr";
  const title = data.title || fallbackNewMessageTitle(language);
  const options = {
    body: data.body || "",
    icon: "./favicon-256x256.png",
    badge: "./favicon-96x96.png",
    tag: data.tag || "meshcore-push",
    data: { url_hash: data.url_hash || "" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlHash = event.notification.data?.url_hash || "";
  // Use the SW registration scope as the base URL so subpath deployments
  // (e.g. archworks.co/meshcore/) navigate correctly.
  const base = self.registration.scope;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one is open
        for (const client of windowClients) {
          if (client.url.startsWith(base)) {
            client.focus();
            if (urlHash) {
              client.navigate(base + urlHash);
            }
            return;
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(base + (urlHash || ""));
      })
  );
});
