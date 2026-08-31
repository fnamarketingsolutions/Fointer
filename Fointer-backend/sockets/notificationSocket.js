import { userNotificationRoom } from "../utils/notify.js";

export const initNotificationSocket = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.user?._id;
    if (userId) {
      socket.join(userNotificationRoom(userId));
    }
  });
};
