const STORAGE_KEY = "fointer_referral_code";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

/** Normalize invite codes from URL, form, or storage. */
export const normalizeReferralCode = (raw) => {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!value || value.length < 4 || value.length > 32) return "";
  return value;
};

const normalizeCode = normalizeReferralCode;

const writeCookie = (code) => {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location?.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(code)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
};

const readCookie = () => {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STORAGE_KEY}=`));
  if (!match) return "";
  return normalizeCode(decodeURIComponent(match.slice(STORAGE_KEY.length + 1)));
};

/** Persist invite code from URL (?ref=) for signup / social auth. */
export const captureReferralCode = (raw) => {
  const code = normalizeCode(raw);
  if (!code) return "";
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode */
  }
  writeCookie(code);
  return code;
};

export const getStoredReferralCode = () => {
  try {
    const fromStorage = normalizeCode(localStorage.getItem(STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    /* ignore */
  }
  return readCookie();
};

export const clearStoredReferralCode = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
};

/** Read ?ref= from the current location and store it. */
export const captureReferralFromLocation = (search = "") => {
  try {
    const params = new URLSearchParams(
      search ||
        (typeof window !== "undefined" ? window.location.search : "")
    );
    return captureReferralCode(params.get("ref") || params.get("referral"));
  } catch {
    return "";
  }
};
