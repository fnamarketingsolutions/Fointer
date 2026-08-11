import { io } from "socket.io-client";

export const watchGroupSocketEvents = {
  joinGroup: "watchGroup:join",
  leaveGroup: "watchGroup:leave",
  messageCreated: "message:created",
  messageUpdated: "message:updated",
  messageDeleted: "message:deleted",
  groupStatusUpdated: "group:statusUpdated",
};

/**
 * Prefer dedicated socket URL; otherwise same-origin (Vite proxies /socket.io
 * to the backend in local/dev). Strip trailing /api if someone reused the
 * HTTP API base URL by mistake.
 */
const resolveSocketUrl = () => {
  const dedicated = import.meta.env.VITE_BACKEND_SOCKET_URL;
  if (dedicated) return dedicated;

  const apiBase = import.meta.env.VITE_BACKEND_URL;
  if (!apiBase || apiBase.startsWith("/")) return undefined;

  return String(apiBase).replace(/\/api\/?$/, "");
};

let socketInstance = null;
const joinedGroups = new Set();

export const getWatchGroupChatSocket = () => {
  if (socketInstance) return socketInstance;

  socketInstance = io(resolveSocketUrl(), {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });

  socketInstance.on("connect", () => {
    for (const groupId of joinedGroups) {
      socketInstance.emit(watchGroupSocketEvents.joinGroup, { groupId });
    }
  });

  return socketInstance;
};

export const joinWatchGroupRoom = (groupId) => {
  if (!groupId) return;
  const id = String(groupId);
  joinedGroups.add(id);
  const socket = getWatchGroupChatSocket();
  if (socket.connected) {
    socket.emit(watchGroupSocketEvents.joinGroup, { groupId: id });
  }
};

export const leaveWatchGroupRoom = (groupId) => {
  if (!groupId) return;
  const id = String(groupId);
  joinedGroups.delete(id);
  if (!socketInstance) return;
  socketInstance.emit(watchGroupSocketEvents.leaveGroup, { groupId: id });
};
