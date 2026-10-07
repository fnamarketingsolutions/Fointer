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
import notificationRoute from "./routes/notificationRoute.js";
import searchRoute from "./routes/searchRoute.js";
import userRoute from "./routes/userRoute.js";
import marketplaceRoute from "./routes/marketplaceRoute.js";
import bookmarkRoute from "./routes/bookmarkRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import blockRoute from "./routes/blockRoute.js";
import bannerRoute from "./routes/bannerRoute.js";
import userSupportRoute from "./routes/userSupportRoute.js";
import locationRoute from "./routes/locationRoute.js";
import referralRoute from "./routes/referralRoute.js";
import sponsorshipRoute from "./routes/sponsorshipRoute.js";
import { handleFlutterwaveWebhook } from "./controllers/sponsorship.controller.js";
import { initLiveSocket } from "./sockets/liveSocket.js";
import { initWatchGroupSocket } from "./sockets/watchGroupSocket.js";
import { initNotificationSocket } from "./sockets/notificationSocket.js";
import { initDirectMessageSocket } from "./sockets/directMessageSocket.js";
import { safeErrorMessage } from "./utils/safeError.js";
import { getAllowedOrigins } from "./utils/allowedOrigins.js";
import { csrfProtect } from "./middleware/csrf.middleware.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

// Only trust X-Forwarded-* when explicitly enabled (or a hop count is set).
// Leaving this always-on lets clients spoof IPs and bypass rate limits when
// the app is exposed without a reverse proxy.
const trustProxyRaw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
if (trustProxyRaw === "true" || trustProxyRaw === "1") {
  app.set("trust proxy", 1);
} else if (/^\d+$/.test(trustProxyRaw)) {
  app.set("trust proxy", Number(trustProxyRaw));
} else if (trustProxyRaw === "false" || trustProxyRaw === "0" || !trustProxyRaw) {
  app.set("trust proxy", false);
} else {
  // e.g. TRUST_PROXY=loopback, TRUST_PROXY=uniquelocal
  app.set("trust proxy", trustProxyRaw);
}

app.use(
  helmet({
    // API serves JSON; Cross-Origin isolation not required for this app.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

app.post(
  "/api/marketplace/sponsorships/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleFlutterwaveWebhook
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser());

const allowedOrigins = getAllowedOrigins();

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

app.use(csrfProtect);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set("io", io);
initLiveSocket(io);
initWatchGroupSocket(io);
initNotificationSocket(io);
initDirectMessageSocket(io);

app.use("/api/auth", authRoute);
app.use("/api", dashboardRoute);
app.use("/api", channelRoute);
app.use("/api/communities", communityRoute);
app.use("/api/posts", postRoute);
app.use("/api/uploads", uploadRoute);
app.use("/api/profile", profileRoute);
app.use("/api/referrals", referralRoute);
app.use("/api/live-events", liveEventRoute);
app.use("/api/watch-groups", watchGroupRoute);
app.use("/api/reports", reportRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/search", searchRoute);
app.use("/api/users", userRoute);
app.use("/api/marketplace", sponsorshipRoute);
app.use("/api/marketplace", marketplaceRoute);
app.use("/api/bookmarks", bookmarkRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/blocks", blockRoute);
app.use("/api/locations", locationRoute);
app.use("/api", bannerRoute);
app.use("/api", userSupportRoute);

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