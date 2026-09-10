import express from "express";
import {
  createReport,
  getReportReasons,
} from "../controllers/report.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { memberReportRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/reasons", isAuthenticated, getReportReasons);
router.post("/", isAuthenticated, memberReportRateLimit, createReport);

export default router;
