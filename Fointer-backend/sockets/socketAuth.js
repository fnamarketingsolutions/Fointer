import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { getHandshakeToken } from "../utils/authToken.js";

export const parseCookies = (header = "") => {
  const out = {};
  String(header)
    .split(";")
    .forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    });
  return out;
};

export const authenticateSocket = async (socket) => {
  const token = getHandshakeToken(socket);
  if (!token) {
    throw new Error("Please login to continue.");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    throw new Error("User not found.");
  }
  if (user.status === "suspended" || user.status === "banned") {
    throw new Error(`Your account is ${user.status}.`);
  }

  user.role = String(user.role || "user")
    .toLowerCase()
    .trim();
  return user;
};
