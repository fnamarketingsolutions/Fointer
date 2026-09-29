import express from "express";
import {
  getMyInviteLink,
  getMyReferrals,
} from "../controllers/referral.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", isAuthenticated, getMyReferrals);
router.get("/me/link", isAuthenticated, getMyInviteLink);

export default router;
