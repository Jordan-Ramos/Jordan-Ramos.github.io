/* Little Plate — notification service worker. Does not cache the app. */

function appUrl(path) {
  const clean = String(path || "schedule").replace(/^\//, "");
  return new URL(clean, self.registration.scope).href;
}

const armed = new Map();

function clearArmed() {
  for (const handle of armed.values()) clearTimeout(handle);
  armed.clear();
}

function showNote(title, body, tag, url) {
  return self.registration.showNotification(title || "Little Plate", {
    body: body || "",
    tag: tag || "little-plate",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: appUrl(url) },
  });
}

function armAlerts(alerts) {
  clearArmed();
  const now = Date.now();
  for (const alert of alerts || []) {
    const delay = Number(alert.fireAt) - now;
    if (!Number.isFinite(delay) || delay <= 0 || delay > 48 * 60 * 60 * 1000) continue;
    const handle = setTimeout(() => {
      void showNote(alert.title, alert.body, alert.tag, "schedule");
    }, delay);
    armed.set(alert.id || alert.tag, handle);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Little Plate", body: "Time for the next item on the day.", tag: "little-plate", url: "schedule" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(showNote(payload.title, payload.body, payload.tag, payload.url));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || appUrl("schedule");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "ARM") {
    armAlerts(data.alerts);
    return;
  }
  if (data.type === "SHOW" && data.title) {
    event.waitUntil(showNote(data.title, data.body, data.tag, data.url));
  }
});
