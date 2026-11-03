import express from "express";
import { getIceServers } from "../controllers/webrtc.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { turnCredentialRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/ice-servers", isAuthenticated, turnCredentialRateLimit, getIceServers);

export default router;