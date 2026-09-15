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

const withCallQuery = (path, action) => {
  const base = path || "/messages";
  if (!action || action === "open") return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}callAction=${encodeURIComponent(action)}`;
};

/** Only allow same-origin relative paths (block absolute / protocol-relative URLs). */
const safeNotificationUrl = (rawPath, action) => {
  const withQuery = withCallQuery(rawPath || "/notifications", action);
  try {
    const url = new URL(withQuery, self.location.origin);
    if (url.origin !== self.location.origin) {
      return new URL("/notifications", self.location.origin).href;
    }
    // Reject attempts that used an absolute URL string resolved against origin oddly
    if (/^https?:\/\//i.test(String(rawPath || "")) || String(rawPath || "").startsWith("//")) {
      return new URL("/notifications", self.location.origin).href;
    }
    return url.href;
  } catch {
    return new URL("/notifications", self.location.origin).href;
  }
};

const showCallOrDefaultNotification = (payload) => {
  const data = payload?.data || {};
  const title = payload?.notification?.title || data.title || "Fointer";
  const body = payload?.notification?.body || data.body || "";
  const tag = data.notificationId || data.tag || "fointer";
  const isCall = String(data.type || "") === "direct_call";
  const path = data.path || "/notifications";

  return self.registration.showNotification(title, {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag,
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [400, 200, 400, 200, 400] : undefined,
    actions: isCall
      ? [
          { action: "accept", title: "Accept" },
          { action: "decline", title: "Decline" },
        ]
      : [],
    data: {
      path,
      url: data.url || path,
      type: data.type || "",
      tag,
    },
  });
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
        // When FCM includes a `notification` block, the browser already shows it
        // (with Accept/Decline from webpush actions). Only show manually for
        // data-only payloads.
        if (payload?.notification) return;
        return showCallOrDefaultNotification(payload);
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
  if (event.data?.type === "CLOSE_CALL_NOTIFICATION") {
    const tag = event.data.tag;
    event.waitUntil(
      self.registration.getNotifications({ tag }).then((list) => {
        list.forEach((n) => n.close());
      })
    );
    return;
  }
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
  const data = event.notification?.data || {};
  const action = event.action || "open";
  const target = safeNotificationUrl(data.path, action);
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
