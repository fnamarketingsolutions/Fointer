import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { getRequestToken } from "../utils/authToken.js";
import {
  canAccessAdminTab,
  resolveIsSuperAdmin,
} from "../utils/adminAccess.js";

const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .trim();

export const isAuthenticated = async (req, res, next) => {
  try {
    const token = getRequestToken(req);

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
    const token = getRequestToken(req);
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

/** Admin Management + promote/demote — super admins only. */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || normalizeRole(req.user.role) !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden.",
    });
  }

  if (!resolveIsSuperAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Super admin access required.",
    });
  }

  next();
};

/**
 * Gate an admin API to one or more panel tabs.
 * Super admins always pass. Limited admins need at least one matching tab.
 */
export const requireAdminTab =
  (...tabIds) =>
  (req, res, next) => {
    if (!req.user || normalizeRole(req.user.role) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden.",
      });
    }

    const allowed = tabIds.some((tabId) => canAccessAdminTab(req.user, tabId));
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this section.",
      });
    }

    next();
  };
