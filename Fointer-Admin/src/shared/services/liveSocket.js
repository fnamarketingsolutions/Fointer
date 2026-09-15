import { io } from 'socket.io-client';
import { getAccessToken } from './http/accessToken';

let socket = null;

const resolveSocketUrl = () => {
  const explicit = String(import.meta.env.VITE_SOCKET_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const apiBase = String(import.meta.env.VITE_BACKEND_URL || '').trim();
  if (!apiBase) return undefined;
  try {
    const url = new URL(apiBase, window.location.origin);
    // VITE_BACKEND_URL is usually https://api.fointer.net/api
    return url.origin;
  } catch {
    return undefined;
  }
};

/**
 * Shared Socket.IO client. In production, connects to the API host
 * (VITE_SOCKET_URL or derived from VITE_BACKEND_URL). Auth via cookie
 * and/or Bearer token in handshake.auth.
 */
export const getLiveSocket = () => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const url = resolveSocketUrl();
  const token = getAccessToken();

  socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: token ? { token } : {},
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
