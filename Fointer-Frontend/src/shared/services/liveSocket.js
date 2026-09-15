import { io } from 'socket.io-client';

let socket = null;

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
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
};

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
