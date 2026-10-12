import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { getHandshakeToken } from "../utils/authToken.js";
import { logRealtime } from "../utils/realtimeLog.js";
import { accountCanConnect } from "../utils/realtimeDelivery.js";

const rejectSocket = (reason, message) => {
  logRealtime("auth_failed", { reason });
  throw new Error(message);
};

export const authenticateSocket = async (socket) => {
  const token = getHandshakeToken(socket);
  if (!token) {
    rejectSocket("missing_token", "Please login to continue.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    rejectSocket("invalid_token", "Please login to continue.");
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    rejectSocket("user_not_found", "User not found.");
  }
  if (!accountCanConnect(user.status)) {
    rejectSocket("account_blocked", `Your account is ${user.status}.`);
  }

  user.role = String(user.role || "user")
    .toLowerCase()
    .trim();
  return user;
};
