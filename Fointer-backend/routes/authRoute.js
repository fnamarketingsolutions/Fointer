import express from "express";
import {
  signup,
  login,
  logout,
  getMe,
  googleLogin,
  facebookLogin,
  verifyEmailOtp,
  resendVerificationEmail,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import {
  authRateLimit,
  otpRateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/signup", authRateLimit, signup);
router.post("/login", authRateLimit, login);
router.post("/verify-email-otp", otpRateLimit, verifyEmailOtp);
router.post("/resend-verification", otpRateLimit, resendVerificationEmail);
router.post("/google", authRateLimit, googleLogin);
router.post("/facebook", authRateLimit, facebookLogin);

router.post("/logout", logout);
router.get("/me", isAuthenticated, getMe);

export default router;
