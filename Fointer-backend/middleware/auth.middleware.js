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

const USER_CACHE_MS = 45_000;
const userCache = new Map();
const userLoads = new Map();

const isBlockedStatus = (user) =>
  user?.status === "suspended" || user?.status === "banned";

const loadUser = (id) => {
  const key = String(id || "");
  if (!key) return Promise.resolve(null);
  const hit = userCache.get(key);
  if (hit && Date.now() - hit.at < USER_CACHE_MS) return Promise.resolve(hit.user);

  const pending = userLoads.get(key);
  if (pending) return pending;

  const request = User.findById(key)
    .select("-password")
    .then((user) => {
      if (user) {
        user.role = normalizeRole(user.role) || "user";
        userCache.set(key, { user, at: Date.now() });
      }
      return user;
    })
    .finally(() => {
      userLoads.delete(key);
    });
  userLoads.set(key, request);
  return request;
};

const attachUser = (req, user) => {
  if (!user || isBlockedStatus(user)) return;
  user.role = normalizeRole(user.role) || "user";
  req.user = user;
};

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

    const user = await loadUser(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    if (isBlockedStatus(user)) {
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
    attachUser(req, await loadUser(decoded.id));
  } catch {
    // Ignore invalid tokens for optional auth.
  }
  next();
};

/**
 * Optional auth that does not wait on the database for a normal member.
 * The API and MongoDB are in different regions, so a user lookup before the
 * handler was adding a full extra round trip to every feed request.
 * Admins still load the full account so tab permissions stay accurate.
 */
export const optionalAuthenticateFast = (req, res, next) => {
  try {
    const token = getRequestToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const key = String(decoded.id || "");
    const hit = userCache.get(key);
    if (hit && Date.now() - hit.at < USER_CACHE_MS) {
      attachUser(req, hit.user);
      return next();
    }

    const role = normalizeRole(decoded.role) || "user";
    if (role === "admin") {
      return loadUser(decoded.id)
        .then((user) => {
          attachUser(req, user);
          next();
        })
        .catch(() => next());
    }

    attachUser(req, { _id: decoded.id, role });
    loadUser(decoded.id).catch(() => {});
    return next();
  } catch {
    return next();
  }
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
