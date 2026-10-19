const stripSlash = (value) => String(value || "").trim().replace(/\/$/, "");

const DEFAULT_PUBLIC_SITE = "https://fointer.net";
const DEFAULT_PUBLIC_API = "https://api.fointer.net";

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

/** Origin crawlers use to fetch the branded share image. */
export const getPublicApiUrl = () =>
  stripSlash(
    process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      DEFAULT_PUBLIC_API
  ) || DEFAULT_PUBLIC_API;

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
