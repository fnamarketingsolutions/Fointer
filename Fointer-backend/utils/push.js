import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging as getFirebaseMessaging } from "firebase-admin/messaging";
import PushDevice from "../models/pushDevice.js";
import { notificationPath } from "./notificationPath.js";

export const ANDROID_CHANNEL_ID =
  String(process.env.FCM_ANDROID_CHANNEL_ID || "fointer_default").trim() ||
  "fointer_default";
const MULTICAST_LIMIT = 500;

const readPrivateKey = () =>
  String(process.env.FIREBASE_PRIVATE_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

const frontendOrigin = () =>
  String(process.env.FRONTEND_URL || "").replace(/\/$/, "");

export const getWebPushConfig = () => {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || "").trim();
  const messagingSenderId = String(
    process.env.FIREBASE_MESSAGING_SENDER_ID || ""
  ).trim();
  const appId = String(process.env.FIREBASE_WEB_APP_ID || "").trim();
  const vapidKey = String(
    process.env.FIREBASE_WEB_VAPID_KEY || process.env.VAPID_PUBLIC_KEY || ""
  ).trim();
  const authDomain = String(
    process.env.FIREBASE_WEB_AUTH_DOMAIN ||
      (projectId ? `${projectId}.firebaseapp.com` : "")
  ).trim();

  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    messagingSenderId,
    appId,
    vapidKey,
  };
};

export const isPushConfigured = () => {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  return Boolean(projectId && clientEmail && readPrivateKey());
};

const getMessaging = () => {
  if (!isPushConfigured()) return null;
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: String(process.env.FIREBASE_PROJECT_ID || "").trim(),
          clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
          privateKey: readPrivateKey(),
        }),
      });
    }
    return getFirebaseMessaging();
  } catch (error) {
    console.error(
      "Firebase messaging init failed:",
      error?.message || error
    );
    return null;
  }
};

const absoluteUrl = (path) => {
  const origin = frontendOrigin();
  const next = String(path || "/notifications");
  const withSlash = next.startsWith("/") ? next : `/${next}`;
  return origin ? `${origin}${withSlash}` : withSlash;
};

const staleToken = (error) => {
  const code = String(error?.code || "");
  return (
    code.includes("registration-token-not-registered") ||
    code.includes("invalid-registration-token") ||
    code.includes("invalid-argument")
  );
};

/**
 * One FCM multicast covers web, Android, and iOS tokens together so they
 * receive the same notification in the same send.
 */
export const pushNotificationToUser = async (recipientId, formatted) => {
  if (!recipientId || !formatted) return;

  const messaging = getMessaging();
  if (!messaging) return;

  const devices = await PushDevice.find({ user: recipientId })
    .select("token")
    .lean();
  const tokens = [
    ...new Set(devices.map((device) => String(device.token || "").trim()).filter(Boolean)),
  ];
  if (!tokens.length) return;

  const path = notificationPath(formatted);
  const url = absoluteUrl(path);
  const title = String(formatted.title || "Fointer").slice(0, 120);
  const body = String(formatted.body || "").slice(0, 240);
  const isCall = String(formatted.type || "") === "direct_call";
  const tag = isCall
    ? `call:${String(formatted.entity?.id || formatted.id || "fointer")}`
    : String(formatted.id || "fointer");
  const data = {
    notificationId: tag,
    type: String(formatted.type || ""),
    path,
    url,
    title,
    body,
    callAction: isCall ? "open" : "",
  };

  const callChannel =
    String(process.env.FCM_ANDROID_CALL_CHANNEL_ID || "").trim() ||
    ANDROID_CHANNEL_ID;

  for (let offset = 0; offset < tokens.length; offset += MULTICAST_LIMIT) {
    const batch = tokens.slice(offset, offset + MULTICAST_LIMIT);
    const result = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data,
      webpush: {
        headers: {
          Urgency: "high",
          TTL: isCall ? "90" : "86400",
        },
        notification: {
          title,
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
            : undefined,
          data: {
            path,
            url,
            type: String(formatted.type || ""),
            tag,
          },
        },
      },
      android: {
        priority: "high",
        collapseKey: tag,
        ttl: isCall ? 90 : undefined,
        notification: {
          channelId: isCall ? callChannel : ANDROID_CHANNEL_ID,
          tag,
          sound: "default",
          priority: "high",
          visibility: "public",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
          ...(isCall ? { "apns-expiration": String(Math.floor(Date.now() / 1000) + 90) } : {}),
        },
        payload: {
          aps: {
            alert: { title, body },
            sound: "default",
            "thread-id": tag,
            ...(isCall ? { "interruption-level": "time-sensitive" } : {}),
          },
        },
      },
    });

    const dead = [];
    result.responses.forEach((response, index) => {
      if (!response.success && staleToken(response.error)) {
        dead.push(batch[index]);
      }
    });
    if (dead.length) {
      await PushDevice.deleteMany({ token: { $in: dead } });
    }
  }
};
