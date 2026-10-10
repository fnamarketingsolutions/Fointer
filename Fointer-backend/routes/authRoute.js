import express from "express";
import {
  signup,
  login,
  adminLogin,
  adminGoogleLogin,
  adminFacebookLogin,
  logout,
  getMe,
  googleLogin,
  facebookLogin,
  verifyEmailOtp,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  isAuthenticated,
  authorize,
} from "../middleware/auth.middleware.js";
import {
  authRateLimit,
  otpRateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/signup", authRateLimit, signup);
router.post("/login", authRateLimit, login);
router.post("/admin/login", authRateLimit, adminLogin);
router.post("/admin/google", authRateLimit, adminGoogleLogin);
router.post("/admin/facebook", authRateLimit, adminFacebookLogin);
router.post("/verify-email-otp", otpRateLimit, verifyEmailOtp);
router.post("/resend-verification", otpRateLimit, resendVerificationEmail);
router.post("/forgot-password", otpRateLimit, forgotPassword);
router.post("/reset-password", otpRateLimit, resetPassword);
router.post("/google", authRateLimit, googleLogin);
router.post("/facebook", authRateLimit, facebookLogin);

router.post("/logout", logout);
router.get("/me", isAuthenticated, getMe);
// Admin SPA bootstrap — role enforced on the server, not only in the UI.
router.get("/admin/me", isAuthenticated, authorize("admin"), getMe);

export default router;
