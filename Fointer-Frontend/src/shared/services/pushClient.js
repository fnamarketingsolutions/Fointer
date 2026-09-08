import api from './http/client';

const DEVICE_KEY = 'fointer-push-device-id';
const TOKEN_KEY = 'fointer-push-token';

let activeUserId = '';
let syncing = null;

const deviceId = () => {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return '';
  }
};

const storedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const rememberToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

const waitForReady = (registration) =>
  new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 4000);
    const onMessage = (event) => {
      if (event.data?.type !== 'FIREBASE_READY') return;
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    const worker = registration.active || registration.waiting || registration.installing;
    worker?.postMessage({ type: 'PING' });
  });

const postConfig = (registration, config) => {
  const worker = registration.active || navigator.serviceWorker.controller;
  worker?.postMessage({ type: 'FIREBASE_CONFIG', config });
};

export const unregisterCurrentPush = async () => {
  const token = storedToken();
  activeUserId = '';
  rememberToken('');
  if (!token) return;
  try {
    await api.delete('/notifications/push/devices', { data: { token } });
  } catch {
    /* logout should still proceed */
  }
};

let permissionRequest = null;

/** Call this from a click handler, before any await, so the browser can show Allow. */
export const beginPushPermissionPrompt = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  if (!permissionRequest) {
    permissionRequest = Notification.requestPermission().catch(() => 'default');
  }
};

const waitForPushPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (permissionRequest) await permissionRequest;
  return Notification.permission;
};

export const syncPushRegistration = (userId) => {
  const id = String(userId || '');
  if (!id || activeUserId === id) return syncing || Promise.resolve();
  if (syncing) return syncing;

  syncing = (async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const permission = await waitForPushPermission();
    if (permission !== 'granted') return;

    const { data } = await api.get('/notifications/push/config');
    if (!data?.enabled || !data?.web?.apiKey || !data.web.vapidKey) return;

    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported().catch(() => false))) return;

    const registration = await navigator.serviceWorker.register('/push-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    postConfig(registration, data.web);
    await waitForReady(registration);

    const web = data.web;
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey: web.apiKey,
          authDomain: web.authDomain,
          projectId: web.projectId,
          messagingSenderId: web.messagingSenderId,
          appId: web.appId,
        });

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: web.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    const previous = storedToken();
    if (previous && previous !== token) {
      try {
        await api.delete('/notifications/push/devices', { data: { token: previous } });
      } catch {
        /* replaced below */
      }
    }

    await api.post('/notifications/push/devices', {
      token,
      platform: 'web',
      deviceId: deviceId(),
    });
    rememberToken(token);
    activeUserId = id;
    return { ok: true };
  })()
    .catch(() => {
      activeUserId = '';
      return { ok: false, reason: 'failed' };
    })
    .finally(() => {
      syncing = null;
    });

  return syncing;
};
