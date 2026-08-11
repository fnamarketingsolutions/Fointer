import { io } from "socket.io-client";

export const liveEventSocketEvents = {
  joinEvent: "liveEvent:join",
  leaveEvent: "liveEvent:leave",
  messageCreated: "liveEvent:message:created",
  messageUpdated: "liveEvent:message:updated",
  messageDeleted: "liveEvent:message:deleted",
  eventStatusUpdated: "liveEvent:statusUpdated",
};

const resolveSocketUrl = () => {
  const dedicated = import.meta.env.VITE_BACKEND_SOCKET_URL;
  if (dedicated) return dedicated;

  const apiBase = import.meta.env.VITE_BACKEND_URL;
  if (!apiBase || apiBase.startsWith("/")) return undefined;

  return String(apiBase).replace(/\/api\/?$/, "");
};

let socketInstance = null;
const joinedEvents = new Set();

export const getLiveEventChatSocket = () => {
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
    for (const eventId of joinedEvents) {
      socketInstance.emit(liveEventSocketEvents.joinEvent, { eventId });
    }
  });

  return socketInstance;
};

export const joinLiveEventRoom = (eventId) => {
  if (!eventId) return;
  const id = String(eventId);
  joinedEvents.add(id);
  const socket = getLiveEventChatSocket();
  if (socket.connected) {
    socket.emit(liveEventSocketEvents.joinEvent, { eventId: id });
  }
};

export const leaveLiveEventRoom = (eventId) => {
  if (!eventId) return;
  const id = String(eventId);
  joinedEvents.delete(id);
  if (!socketInstance) return;
  socketInstance.emit(liveEventSocketEvents.leaveEvent, { eventId: id });
};
