import "dotenv/config";
import express from "express";
import cors from "cors";
import dns from "dns";
import http from "http";
import { Server } from "socket.io";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoute from "./routes/authRoute.js";
import dashboardRoute from "./routes/dashboardRoute.js";
import communityRoute from "./routes/communityRoute.js";
import channelRoute from "./routes/channelRoute.js";
import postRoute from "./routes/postRoute.js";
import uploadRoute from "./routes/uploadRoute.js";
import profileRoute from "./routes/profileRoute.js";
import liveEventRoute from "./routes/liveEventRoute.js";
import watchGroupRoute from "./routes/watchGroupRoute.js";
import reportRoute from "./routes/reportRoute.js";
import { initLiveSocket } from "./sockets/liveSocket.js";
import { initWatchGroupSocket } from "./sockets/watchGroupSocket.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://fointer.vercel.app",
  "https://punctual-droop-viper.ngrok-free.dev",
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set("io", io);
initLiveSocket(io);
initWatchGroupSocket(io);

app.use("/api/auth", authRoute);
app.use("/api", dashboardRoute);
app.use("/api", channelRoute);
app.use("/api/communities", communityRoute);
app.use("/api/posts", postRoute);
app.use("/api/uploads", uploadRoute);
app.use("/api/profile", profileRoute);
app.use("/api/live-events", liveEventRoute);
app.use("/api/watch-groups", watchGroupRoute);
app.use("/api/reports", reportRoute);

connectDB();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
