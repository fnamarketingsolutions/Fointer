const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/;

export const normalizePostalCode = (value) => String(value || "").trim().slice(0, 12);

export const postalCodeError = (value) => {
  const code = normalizePostalCode(value);
  if (!code) return "";
  if (!POSTAL_RE.test(code)) return "Enter a valid postal code.";
  return "";
};
