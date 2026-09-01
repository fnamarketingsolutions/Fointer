import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { getHandshakeToken } from "../utils/authToken.js";

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
