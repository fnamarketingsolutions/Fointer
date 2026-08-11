import { LIVE_EVENT_SOCKET_EVENTS, toLiveEventRoom } from "./events.js";

export const registerLiveEventMessageSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on(LIVE_EVENT_SOCKET_EVENTS.JOIN_EVENT, ({ eventId } = {}) => {
      if (!eventId) return;
      socket.join(toLiveEventRoom(String(eventId)));
    });

    socket.on(LIVE_EVENT_SOCKET_EVENTS.LEAVE_EVENT, ({ eventId } = {}) => {
      if (!eventId) return;
      socket.leave(toLiveEventRoom(String(eventId)));
    });
  });
};
