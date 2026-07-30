import express from "express";
import {
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
} from "../controllers/profile.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", isAuthenticated, getMyProfile);
router.patch("/me", isAuthenticated, updateMyProfile);
router.patch("/password", isAuthenticated, updateMyPassword);

export default router;
