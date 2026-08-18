import rateLimit from "express-rate-limit";

const jsonLimitMessage = (message) => ({
  success: false,
  message,
});

/** Login / signup / OAuth — blunt credential stuffing. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many auth attempts. Please try again later."),
});

/** OTP verify + resend — tighter than general auth. */
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many OTP requests. Please try again later."),
});

/** Media uploads — memory-backed buffers. */
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many uploads. Please try again later."),
});
