/* global firebase, clients */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

const CONFIG_CACHE = "fointer-push";
const CONFIG_KEY = "/push-firebase-config.json";
const CONFIG_URL = "/api/notifications/push/config";

let messagingReady = null;
let backgroundBound = false;

const readCachedConfig = async () => {
  const cache = await caches.open(CONFIG_CACHE);
  const cached = await cache.match(CONFIG_KEY);
  if (!cached) return null;
  const web = await cached.json();
  return web?.apiKey ? web : null;
};

const writeCachedConfig = async (web) => {
  if (!web?.apiKey) return;
  const cache = await caches.open(CONFIG_CACHE);
  await cache.put(
    CONFIG_KEY,
    new Response(JSON.stringify(web), {
      headers: { "Content-Type": "application/json" },
    })
  );
};

const loadConfig = async (preferred) => {
  if (preferred?.apiKey) return preferred;
  const cached = await readCachedConfig();
  if (cached) return cached;
  const response = await fetch(CONFIG_URL, { credentials: "same-origin" });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.enabled || !data.web?.apiKey) return null;
  await writeCachedConfig(data.web);
  return data.web;
};

const ensureMessaging = (preferred) => {
  if (messagingReady) return messagingReady;
  messagingReady = (async () => {
    const web = await loadConfig(preferred);
    if (!web?.apiKey) {
      messagingReady = null;
      return null;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: web.apiKey,
        authDomain: web.authDomain,
        projectId: web.projectId,
        messagingSenderId: web.messagingSenderId,
        appId: web.appId,
      });
    }
    const messaging = firebase.messaging();
    if (!backgroundBound) {
      backgroundBound = true;
      messaging.onBackgroundMessage((payload) => {
        if (payload?.notification) return;
        const data = payload?.data || {};
        const title = payload?.notification?.title || data.title || "Fointer";
        const body = payload?.notification?.body || data.body || "";
        const tag = data.notificationId || "fointer";
        return self.registration.showNotification(title, {
          body,
          icon: "/favicon.svg",
          tag,
          data: {
            path: data.path || "/notifications",
            url: data.url || data.path || "/notifications",
          },
        });
      });
    }
    return messaging;
  })().catch(() => {
    messagingReady = null;
    return null;
  });
  return messagingReady;
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "FIREBASE_CONFIG") return;
  event.waitUntil(
    (async () => {
      if (event.data.config?.apiKey) {
        await writeCachedConfig(event.data.config);
      }
      messagingReady = null;
      await ensureMessaging(event.data.config);
      event.source?.postMessage({ type: "FIREBASE_READY" });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification?.data?.path || "/notifications";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (!("focus" in client)) continue;
          if (typeof client.navigate === "function") {
            return client.navigate(target).then(() => client.focus());
          }
          return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(target);
        return undefined;
      })
  );
});

ensureMessaging();
