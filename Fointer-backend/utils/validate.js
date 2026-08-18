/** Shared input helpers for controllers (light validation layer). */

export const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const asTrimmedString = (value) => String(value ?? "").trim();

export const requireNonEmptyString = (value, fieldName = "Field") => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) {
    const error = new Error(`${fieldName} is required.`);
    error.isOperational = true;
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
};
