const CACHE_VERSION = "ci6-push-v1";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : "" }; }

  const title = data.title || "CI6 Connect";
  const options = {
    body: data.body || "Une information a été publiée.",
    tag: data.tag || "ci6-information",
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.urgent),
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(destination);
  })());
});
