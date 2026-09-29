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

/** Each file uses a signature request plus a confirm request. */
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many uploads. Please try again later."),
});

/** Country, state, city, and postal lookups during signup. */
export const locationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many location lookups. Please try again later."),
});

/** Admin warnings / report actions — abuse & auto-ban floods. */
export const adminModerationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage(
    "Too many moderation actions. Please try again later."
  ),
});

/** Member report / support ticket creation. */
export const memberReportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage("Too many requests. Please try again later."),
});

/** Start a new 1:1 conversation — curb mass outreach / harassment. */
export const dmCreateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage(
    "Too many new chats. Please wait a bit and try again."
  ),
});

/** Send a DM (text/media/share) — curb spam floods. */
export const dmSendRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage(
    "Too many messages. Please wait a bit and try again."
  ),
});
