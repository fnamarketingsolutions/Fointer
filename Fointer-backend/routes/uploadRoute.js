import express from "express";
import {
  signDirectUpload,
  completeDirectUpload,
} from "../controllers/upload.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { uploadRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/signature", isAuthenticated, uploadRateLimit, signDirectUpload);
router.post("/complete", isAuthenticated, uploadRateLimit, completeDirectUpload);

export default router;
