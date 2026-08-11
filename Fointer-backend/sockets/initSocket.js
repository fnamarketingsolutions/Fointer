import { Server } from "socket.io";

let io = null;
// const allowedOrigins = [
//   "http://localhost:5173",
//   "http://localhost:5174",
//   "https://fointer.vercel.app",
//   "https://punctual-droop-viper.ngrok-free.dev",
// ];

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      // Mirror Express CORS (origin: true) so local + deployed clients can connect.
      origin: true,
      // origin: (origin, callback) => {
      //   if (!origin || allowedOrigins.includes(origin)) {
      //     callback(null, true);
      //     return;
      //   }
      //   callback(null, true);
      // },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  return io;
};

export const getIo = () => io;
