import { registerWatchGroupMessageSocket } from "./watchGroupMessage.socket.js";

export const registerSocketModules = (io) => {
  registerWatchGroupMessageSocket(io);
};
