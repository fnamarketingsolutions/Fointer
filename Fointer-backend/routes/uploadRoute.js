import express from "express";
import {
  uploadMedia,
  signDirectUpload,
  completeDirectUpload,
} from "../controllers/upload.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { uploadSingle } from "../middleware/upload.middleware.js";
import { uploadRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/signature", isAuthenticated, uploadRateLimit, signDirectUpload);
router.post("/complete", isAuthenticated, uploadRateLimit, completeDirectUpload);

router.post(
  "/",
  isAuthenticated,
  uploadRateLimit,
  uploadSingle("file"),
  uploadMedia
);

export default router;
