import express from "express";
import {
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  deleteMyAccount,
  getMyDeletionBlockers,
} from "../controllers/profile.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", isAuthenticated, getMyProfile);
router.get("/me/deletion-blockers", isAuthenticated, getMyDeletionBlockers);
router.patch("/me", isAuthenticated, updateMyProfile);
router.delete("/me", isAuthenticated, deleteMyAccount);
router.patch("/password", isAuthenticated, updateMyPassword);

export default router;
