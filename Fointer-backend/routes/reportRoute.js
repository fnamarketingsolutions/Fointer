import express from "express";
import {
  createReport,
  getReportReasons,
} from "../controllers/report.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/reasons", isAuthenticated, getReportReasons);
router.post("/", isAuthenticated, createReport);

export default router;
