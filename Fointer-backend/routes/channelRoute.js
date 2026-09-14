import express from "express";
import {
  createChannel,
  listChannels,
  updateChannel,
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
import {
  isAuthenticated,
  authorize,
  optionalAuthenticate,
  requireAdminTab,
} from "../middleware/auth.middleware.js";
import { memberReportRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

const adminGate = (tab) => [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab(tab),
];

router.get("/channels", optionalAuthenticate, listChannels);
router.get("/subchannels", isAuthenticated, listSubchannels);

// Admin channel CRUD
router.post("/admin/channels", ...adminGate("channels"), createChannel);
// Support needs the list to attach subchannels to an existing parent when approving.
router.get(
  "/admin/channels",
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("channels", "support"),
  listChannels
);
router.put("/admin/channels/:id", ...adminGate("channels"), updateChannel);

// Admin subchannel CRUD
router.post(
  "/admin/subchannels",
  ...adminGate("channels"),
  createSubchannel
);
router.get(
  "/admin/subchannels",
  ...adminGate("channels"),
  listSubchannels
);
router.put(
  "/admin/subchannels/:id",
  ...adminGate("channels"),
  updateSubchannel
);

// Support tickets
router.post("/support", isAuthenticated, memberReportRateLimit, createSupportTicket);
router.get("/support/mine", isAuthenticated, listMySupportTickets);
router.get(
  "/admin/support",
  ...adminGate("support"),
  listAdminSupportTickets
);
router.patch(
  "/admin/support/:id/status",
  ...adminGate("support"),
  updateSupportTicketStatus
);

export default router;