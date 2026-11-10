import express from "express";
import { getIceServers, postCallDiagnostic } from "../controllers/webrtc.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { callDiagnosticRateLimit, turnCredentialRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/ice-servers", isAuthenticated, turnCredentialRateLimit, getIceServers);
router.post("/diagnostics", isAuthenticated, callDiagnosticRateLimit, postCallDiagnostic);

export default router;