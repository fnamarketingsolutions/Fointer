import express from "express";
import rateLimit from "express-rate-limit";
import { optionalAuthenticateFast } from "../middleware/auth.middleware.js";
import { downloadWatermarkedMedia } from "../controllers/mediaDownload.controller.js";

const router = express.Router();

const downloadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many downloads. Please try again later.",
  },
});

router.get(
  "/download",
  downloadRateLimit,
  optionalAuthenticateFast,
  downloadWatermarkedMedia
);

export default router;
