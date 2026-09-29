/** Shared input helpers for controllers (light validation layer). */

export const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const PHONE_RE = /^[+\d][\d\s().-]{6,30}$/;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES_HINT =
  "Password must be 8–128 characters and include uppercase, lowercase, and a number.";

/**
 * Stronger password gate for signup / password change.
 * Returns { ok: true } or { ok: false, message }.
 */
export const validatePasswordStrength = (password) => {
  const value = String(password ?? "");
  if (value.length < 8) {
    return {
      ok: false,
      message: "Password must be at least 8 characters.",
    };
  }
  if (value.length > 128) {
    return {
      ok: false,
      message: "Password must be at most 128 characters.",
    };
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return {
      ok: false,
      message: PASSWORD_RULES_HINT,
    };
  }
  return { ok: true };
};

export const parseOptionalYear = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const year = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(year)) return NaN;
  return year;
};
