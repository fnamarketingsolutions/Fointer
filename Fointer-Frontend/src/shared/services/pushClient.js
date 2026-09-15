import api from './http/client';

const DEVICE_KEY = 'fointer-push-device-id';
const TOKEN_KEY = 'fointer-push-token';
const LAST_ERROR_KEY = 'fointer-push-last-error';

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

export const storedPushToken = () => {
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

const rememberError = (reason, detail = '') => {
  try {
    sessionStorage.setItem(
      LAST_ERROR_KEY,
      JSON.stringify({ reason, detail: String(detail || ''), at: Date.now() })
    );
  } catch {
    /* ignore */
  }
};

export const getPushLastError = () => {
  try {
    const raw = sessionStorage.getItem(LAST_ERROR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const waitForActiveRegistration = async (registration) => {
  if (registration.active) return registration;
  await navigator.serviceWorker.ready;
  if (registration.active) return registration;

  const pending = registration.installing || registration.waiting;
  if (!pending) return registration;

  await new Promise((resolve) => {
    const done = () => {
      if (registration.active || pending.state === 'activated' || pending.state === 'redundant') {
        pending.removeEventListener('statechange', done);
        resolve();
      }
    };
    pending.addEventListener('statechange', done);
    window.setTimeout(resolve, 5000);
  });
  return registration;
};

const waitForReady = (registration) =>
  new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 5000);
    const onMessage = (event) => {
      if (event.data?.type !== 'FIREBASE_READY') return;
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
  });

const postConfig = (registration, config) => {
  const worker =
    registration.active ||
    registration.waiting ||
    registration.installing ||
    navigator.serviceWorker.controller;
  worker?.postMessage({ type: 'FIREBASE_CONFIG', config });
};

const resolvePushConfigUrl = () => {
  const base = String(import.meta.env.VITE_BACKEND_URL || '').trim();
  if (base.startsWith('http')) {
    try {
      const url = new URL(base);
      const origin = url.origin;
      const prefix = url.pathname.replace(/\/$/, '') || '/api';
      return `${origin}${prefix}/notifications/push/config`;
    } catch {
      /* fall through */
    }
  }
  return `${window.location.origin}/api/notifications/push/config`;
};

export const unregisterCurrentPush = async () => {
  const token = storedPushToken();
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
    permissionRequest = Notification.requestPermission()
      .catch(() => 'default')
      .finally(() => {
        permissionRequest = null;
      });
  }
};

const waitForPushPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (permissionRequest) await permissionRequest;
  return Notification.permission;
};

const fetchFcmToken = async (messaging, vapidKey, registration) => {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = await getTokenWithTimeout(messaging, vapidKey, registration, 15000);
      if (token) return token;
    } catch (error) {
      lastError = error;
      await new Promise((r) => window.setTimeout(r, 600 * (attempt + 1)));
    }
  }
  if (lastError) throw lastError;
  return '';
};

const getTokenWithTimeout = async (messaging, vapidKey, registration, ms) => {
  const { getToken } = await import('firebase/messaging');
  return Promise.race([
    getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    }),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('getToken_timeout')), ms);
    }),
  ]);
};

/**
 * Register this browser for FCM web push and POST the token to the API.
 * @param {string} userId
 * @param {{ force?: boolean }} [options]
 */
export const syncPushRegistration = (userId, options = {}) => {
  const id = String(userId || '');
  const force = Boolean(options.force);

  if (!id) return Promise.resolve({ ok: false, reason: 'no_user' });

  if (force) {
    activeUserId = '';
  }

  // Skip only when we already registered this session AND still have a local token.
  if (!force && activeUserId === id && storedPushToken()) {
    return syncing || Promise.resolve({ ok: true, reason: 'already_synced' });
  }

  if (syncing) return syncing;

  syncing = (async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      rememberError('unsupported');
      return { ok: false, reason: 'unsupported' };
    }

    const permission = await waitForPushPermission();
    if (permission !== 'granted') {
      rememberError('permission', permission);
      return { ok: false, reason: 'permission', permission };
    }

    const { data } = await api.get('/notifications/push/config');
    if (!data?.enabled || !data?.web?.apiKey || !data.web.vapidKey) {
      rememberError('config_disabled');
      return { ok: false, reason: 'config_disabled' };
    }

    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, isSupported } = await import('firebase/messaging');
    if (!(await isSupported().catch(() => false))) {
      rememberError('not_supported');
      return { ok: false, reason: 'not_supported' };
    }

    let registration;
    try {
      registration = await navigator.serviceWorker.register('/push-sw.js', {
        scope: '/',
      });
      registration = await waitForActiveRegistration(registration);
    } catch (error) {
      rememberError('sw_register_failed', error?.message);
      return { ok: false, reason: 'sw_register_failed' };
    }

    postConfig(registration, {
      ...data.web,
      configUrl: resolvePushConfigUrl(),
    });
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
    let token;
    try {
      token = await fetchFcmToken(messaging, web.vapidKey, registration);
    } catch (error) {
      rememberError('token_failed', error?.code || error?.message);
      activeUserId = '';
      return { ok: false, reason: 'token_failed', detail: error?.code || error?.message };
    }
    if (!token) {
      rememberError('no_token');
      activeUserId = '';
      return { ok: false, reason: 'no_token' };
    }

    const previous = storedPushToken();
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
    try {
      sessionStorage.removeItem(LAST_ERROR_KEY);
    } catch {
      /* ignore */
    }
    activeUserId = id;
    return { ok: true };
  })()
    .catch((error) => {
      activeUserId = '';
      rememberError('failed', error?.message);
      return { ok: false, reason: 'failed', detail: error?.message };
    })
    .finally(() => {
      syncing = null;
    });

  return syncing;
};
