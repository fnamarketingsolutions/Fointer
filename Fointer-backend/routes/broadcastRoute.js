import express from "express";
import {
  listBroadcasts,
  sendBroadcast,
} from "../controllers/broadcast.controller.js";
import {
  isAuthenticated,
  authorize,
  requireAdminTab,
} from "../middleware/auth.middleware.js";

const router = express.Router();

const broadcastAdminGate = [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("broadcasts"),
];

router.get("/admin/broadcasts", ...broadcastAdminGate, listBroadcasts);
router.post("/admin/broadcasts", ...broadcastAdminGate, sendBroadcast);

export default router;
