const stripSlash = (value) => String(value || "").trim().replace(/\/$/, "");

const DEFAULT_PUBLIC_SITE = "https://fointer.net";

/**
 * Absolute member-app origin for outbound emails / notification deep links.
 * Independent of FRONTEND_URL (which may be localhost in local/dev).
 *
 * Override with EMAIL_FRONTEND_URL or PUBLIC_SITE_URL if needed.
 */
export const getPublicFrontendUrl = () =>
  stripSlash(
    process.env.EMAIL_FRONTEND_URL ||
      process.env.PUBLIC_SITE_URL ||
      DEFAULT_PUBLIC_SITE
  ) || DEFAULT_PUBLIC_SITE;

/**
 * Absolute admin-app origin for admin-facing email links.
 * Falls back to the public site when unset.
 */
export const getPublicAdminUrl = () =>
  stripSlash(
    process.env.EMAIL_ADMIN_URL ||
      process.env.PUBLIC_ADMIN_URL ||
      getPublicFrontendUrl()
  ) || DEFAULT_PUBLIC_SITE;
