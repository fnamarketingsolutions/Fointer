import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { safeErrorMessage } from "./utils/safeError.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;
app.set("trust proxy", 1);

app.use(
  helmet({
    // API serves JSON; Cross-Origin isolation not required for this app.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser());

const envFrontendOrigin = String(process.env.FRONTEND_URL || "").replace(
  /\/$/,
  ""
);
const allowedOrigins = [
  ...new Set(
    [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://fointer.vercel.app",
      "https://punctual-droop-viper.ngrok-free.dev",
      envFrontendOrigin,
    ].filter(Boolean)
  ),
];

const corsOrigin = (origin, callback) => {
  // Non-browser clients (curl, server-to-server) may omit Origin.
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
};

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

// Multer / unexpected errors — never leak internals
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const isClient =
    status >= 400 &&
    status < 500 &&
    typeof err.message === "string" &&
    err.message;
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: isClient
      ? err.message
      : safeErrorMessage(err, "Something went wrong. Please try again."),
  });
});

connectDB();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
