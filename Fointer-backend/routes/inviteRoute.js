import express from "express";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import {
  lookupInviteUser,
  inviteUserToCommunity,
} from "../controllers/inviteUser.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/lookup", isAuthenticated, lookupInviteUser);
router.post("/", isAuthenticated, inviteUserToCommunity);

export default router;
