const stripSlash = (value) => String(value || "").trim().replace(/\/$/, "");

/** Reject wildcard / invalid origin entries from env misconfiguration. */
const isSafeOrigin = (value) => {
  if (!value || value === "*" || value.includes("*")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Browser origins allowed for CORS + cookie CSRF checks.
 * Production must set FRONTEND_URL / ADMIN_URL (and optional CORS_ORIGINS).
 * Never put `*` in CORS_ORIGINS — cookie sessions would become CSRF-open.
 */
export const getAllowedOrigins = () => {
  const envFrontendOrigin = stripSlash(process.env.FRONTEND_URL);
  const envAdminOrigin = stripSlash(process.env.ADMIN_URL);
  const extra = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map(stripSlash)
    .filter(isSafeOrigin);
  const isProd = process.env.NODE_ENV === "production";
  const origins = [
    ...new Set(
      [
        isSafeOrigin(envFrontendOrigin) ? envFrontendOrigin : "",
        isSafeOrigin(envAdminOrigin) ? envAdminOrigin : "",
        ...extra,
        !isProd ? "http://localhost:5173" : "",
        !isProd ? "http://localhost:5174" : "",
      ].filter(Boolean)
    ),
  ];

  if (isProd && origins.length === 0) {
    console.warn(
      "[cors] No allowed origins configured. Set FRONTEND_URL and ADMIN_URL (and optional CORS_ORIGINS)."
    );
  }

  return origins;
};

export const originFromReferer = (req) => {
  const referer = String(req.headers.referer || req.headers.referrer || "").trim();
  if (!referer) return "";
  try {
    return stripSlash(new URL(referer).origin);
  } catch {
    return "";
  }
};
