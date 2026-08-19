export const getAuthCookieOptions = (overrides = {}) => {
  const isProduction = process.env.NODE_ENV === "production";
  const useCrossSiteCookies =
    process.env.COOKIE_SAME_SITE === "none" || isProduction;
  return {
    httpOnly: true,
    secure: useCrossSiteCookies,
    sameSite: useCrossSiteCookies ? "none" : "lax",
    ...overrides,
  };
};
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;