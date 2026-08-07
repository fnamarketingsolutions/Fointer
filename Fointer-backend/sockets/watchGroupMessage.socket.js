import { WATCH_GROUP_SOCKET_EVENTS, toWatchGroupRoom } from "./events.js";

export const registerWatchGroupMessageSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on(WATCH_GROUP_SOCKET_EVENTS.JOIN_GROUP, ({ groupId } = {}) => {
      if (!groupId) return;
      socket.join(toWatchGroupRoom(String(groupId)));
    });

    socket.on(WATCH_GROUP_SOCKET_EVENTS.LEAVE_GROUP, ({ groupId } = {}) => {
      if (!groupId) return;
      socket.leave(toWatchGroupRoom(String(groupId)));
    });
  });
};
