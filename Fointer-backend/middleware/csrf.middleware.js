import { getAllowedOrigins } from "../utils/allowedOrigins.js";
import { bearerFromHeader } from "../utils/authToken.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie sessions on a cross-site SPA (SameSite=None) are CSRF-vulnerable
 * to simple form POSTs. Require a trusted Origin for browser cookie auth.
 * Bearer-only API clients may omit Origin.
 */
export const csrfProtect = (req, res, next) => {
  if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) {
    return next();
  }

  const path = String(req.originalUrl || req.url || "");
  if (path.startsWith("/socket.io")) {
    return next();
  }

  const allowed = getAllowedOrigins();
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && allowed.includes(origin)) {
    return next();
  }

  const hasBearer = Boolean(
    bearerFromHeader(req.headers.authorization || req.headers.Authorization)
  );

  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden origin.",
    });
  }

  if (req.cookies?.token && !hasBearer) {
    return res.status(403).json({
      success: false,
      message: "Missing origin.",
    });
  }

  return next();
};
