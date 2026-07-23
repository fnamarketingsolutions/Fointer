import express from "express";
import {
  signup,
  login,
  logout,
  getMe,
  googleLogin,
  facebookLogin,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);

router.post("/facebook", facebookLogin);

router.post("/logout", logout);
router.get("/me", isAuthenticated, getMe);

export default router;
