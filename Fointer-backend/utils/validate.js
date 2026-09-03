/** Shared input helpers for controllers (light validation layer). */

export const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const PHONE_RE = /^[+\d][\d\s().-]{6,30}$/;

export const parseOptionalYear = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const year = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(year)) return NaN;
  return year;
};
