/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<any> };
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);
// Only the static app shell is cached here; private data lives in partitioned IndexedDB.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Wag Journal", {
        body: data.body || "An activity is coming up.",
        icon: "/icon.svg",
        tag: data.tag || "wag-reminder",
        data: { url: "/" },
      }),
    );
  } catch {
    /* Invalid payloads must not crash the worker. */
  }
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      if (clients.length) {
        await (clients[0] as WindowClient).focus();
      } else await self.clients.openWindow("/");
    })(),
  );
});
