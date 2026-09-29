import {
  getAllowedOrigins,
  originFromReferer,
} from "../utils/allowedOrigins.js";
import { bearerFromHeader } from "../utils/authToken.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie sessions on a cross-site SPA (SameSite=None) are CSRF-vulnerable
 * to simple form POSTs. Require a trusted Origin (or Referer) for browser
 * cookie auth. Bearer-only API clients may omit Origin.
 *
 * Misconfigured CORS_ORIGINS wildcards are rejected in getAllowedOrigins.
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

  // Cookie session without Origin: accept only a trusted Referer (older browsers).
  if (req.cookies?.token && !hasBearer) {
    const refererOrigin = originFromReferer(req);
    if (refererOrigin && allowed.includes(refererOrigin)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "Missing or untrusted origin.",
    });
  }

  // No cookie session — Bearer (or unauthenticated) clients without Origin OK.
  return next();
};
