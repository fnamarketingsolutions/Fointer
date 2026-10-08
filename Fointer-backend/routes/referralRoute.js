import express from "express";
import {
  getMyInviteLink,
  getMyReferrals,
  listAdminReferrals,
} from "../controllers/referral.controller.js";
import {
  authorize,
  isAuthenticated,
  requireAdminTab,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", isAuthenticated, getMyReferrals);
router.get("/me/link", isAuthenticated, getMyInviteLink);

router.get(
  "/admin",
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("referrals"),
  listAdminReferrals
);

export default router;
