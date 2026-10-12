import { userNotificationRoom } from "../utils/notify.js";
import { logRealtime } from "../utils/realtimeLog.js";
import { authenticateSocket } from "./socketAuth.js";

export const initNotificationSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      if (!socket.user) {
        socket.user = await authenticateSocket(socket);
      }
      next();
    } catch (error) {
      next(new Error(error.message || "Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?._id;
    if (userId) {
      socket.join(userNotificationRoom(userId));
      logRealtime("connected", { userId: String(userId) });
    }
    socket.on("disconnect", (reason) => {
      logRealtime("disconnected", {
        userId: userId ? String(userId) : "",
        reason: reason || "unknown",
      });
    });
  });
};
