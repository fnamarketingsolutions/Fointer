import jwt from "jsonwebtoken";
import User from "../models/user.js";

const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .trim();

export const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    // Normalize role so authorize("admin") matches Mongo values like "Admin"
    user.role = normalizeRole(user.role) || "user";

    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Contact support.`,
        status: user.status,
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (user) {
      user.role = normalizeRole(user.role) || "user";
      if (user.status !== "suspended" && user.status !== "banned") {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth.
  }
  next();
};

export const authorize = (...roles) => (req, res, next) => {
  const allowed = roles.map(normalizeRole);
  const current = normalizeRole(req.user?.role);

  if (!req.user || !allowed.includes(current)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden.",
    });
  }
  next();
};
