import { registerWatchGroupMessageSocket } from "./watchGroupMessage.socket.js";
import { registerLiveEventMessageSocket } from "./liveEventMessage.socket.js";

export const registerSocketModules = (io) => {
  registerWatchGroupMessageSocket(io);
  registerLiveEventMessageSocket(io);
};
