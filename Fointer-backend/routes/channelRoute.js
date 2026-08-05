import express from "express";
import {
  createChannel,
  listChannels,
} from "../controllers/channel.controller.js";
import {
  createSubchannel,
  listSubchannels,
  updateSubchannel,
} from "../controllers/subchannel.controller.js";
import {
  createSupportTicket,
  listMySupportTickets,
  listAdminSupportTickets,
  updateSupportTicketStatus,
} from "../controllers/support.controller.js";
import { isAuthenticated, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Authenticated lists (users creating communities)
router.get("/channels", isAuthenticated, listChannels);
router.get("/subchannels", isAuthenticated, listSubchannels);

// Admin channel CRUD
router.post(
  "/admin/channels",
  isAuthenticated,
  authorize("admin"),
  createChannel
);
router.get(
  "/admin/channels",
  isAuthenticated,
  authorize("admin"),
  listChannels
);

// Admin subchannel CRUD
router.post(
  "/admin/subchannels",
  isAuthenticated,
  authorize("admin"),
  createSubchannel
);
router.get(
  "/admin/subchannels",
  isAuthenticated,
  authorize("admin"),
  listSubchannels
);
router.put(
  "/admin/subchannels/:id",
  isAuthenticated,
  authorize("admin"),
  updateSubchannel
);

// Support tickets
router.post("/support", isAuthenticated, createSupportTicket);
router.get("/support/mine", isAuthenticated, listMySupportTickets);
router.get(
  "/admin/support",
  isAuthenticated,
  authorize("admin"),
  listAdminSupportTickets
);
router.patch(
  "/admin/support/:id/status",
  isAuthenticated,
  authorize("admin"),
  updateSupportTicketStatus
);

export default router;