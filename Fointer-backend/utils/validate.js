/** Shared input helpers for controllers (light validation layer). */

export const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
