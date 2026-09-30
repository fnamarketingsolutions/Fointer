import crypto from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Normalize client/query codes for lookup. */
export const normalizeReferralCode = (raw) => {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!value || value.length < 4 || value.length > 32) return "";
  return value;
};

export const generateReferralCodeCandidate = (length = CODE_LENGTH) => {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
};
