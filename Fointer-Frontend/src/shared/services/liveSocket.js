import { io } from 'socket.io-client';

let socket = null;
let joinSeq = 0;

/** One token per room subscription so an older leave cannot cancel a newer join. */
export const nextJoinToken = () => {
  joinSeq += 1;
  return joinSeq;
};

const ACK_TIMEOUT_MS = 15000;

/**
 * Resolve the Socket.IO host.
 * - Dev: undefined → same-origin `/socket.io` (Vite proxy)
 * - Prod: VITE_SOCKET_URL, or origin of VITE_BACKEND_URL (e.g. https://api.fointer.net)
 */
const resolveSocketUrl = () => {
  const explicit = String(import.meta.env.VITE_SOCKET_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const apiBase = String(import.meta.env.VITE_BACKEND_URL || '').trim();
  if (!apiBase) return undefined;

  // Relative `/api` → stay same-origin (local Vite proxy)
  if (apiBase.startsWith('/')) return undefined;

  try {
    const url = new URL(apiBase, typeof window !== 'undefined' ? window.location.origin : undefined);
    return url.origin;
  } catch {
    return undefined;
  }
};

/**
 * Shared Socket.IO client. Uses Vite `/socket.io` proxy locally; in production
 * connects to the API host so calls/DMs/live rooms work off fointer.net.
 */
export const getLiveSocket = () => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const url = resolveSocketUrl();

  socket = io(url, {
    withCredentials: true,
    // Polling first so the credentialed XHR sends the auth cookie on the
    // cross-site api host, then upgrades to a websocket on that same session.
    transports: ['polling', 'websocket'],
    upgrade: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect_error', () => {
    if (import.meta.env.DEV) {
      console.warn('Realtime connection failed.');
    }
  });

  return socket;
};

/** Wait for the server ack. Does not retry, so a slow save cannot be duplicated. */
export const emitAck = (event, payload, timeoutMs = ACK_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const live = getLiveSocket();
    if (!live.connected) {
      reject(Object.assign(new Error('Realtime is offline.'), { offline: true }));
      return;
    }
    live.timeout(timeoutMs).emit(event, payload, (err, body) => {
      if (err) {
        reject(new Error('The server took too long to confirm this message.'));
        return;
      }
      resolve(body);
    });
  });

export const resetLiveSocket = () => {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch {
    /* ignore */
  }
  socket = null;
};
