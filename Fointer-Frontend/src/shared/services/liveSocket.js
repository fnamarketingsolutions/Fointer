import { io } from 'socket.io-client';

let socket = null;

/**
 * Shared Socket.IO client. Uses same-origin `/socket.io` (Vite proxy) so
 * httpOnly auth cookies are sent automatically.
 */
export const getLiveSocket = () => {
  if (socket?.connected) return socket;

  const url = import.meta.env.VITE_SOCKET_URL || undefined;

  socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
};
