import express from "express";
import {
  getAdminFreeListing,
  listAdminFreeListings,
  removeAdminFreeListing,
  restoreAdminFreeListing,
  updateAdminFreeListing,
  warnFreeListingSeller,
} from "../controllers/adminFreeListing.controller.js";
import {
  isAuthenticated,
  authorize,
  requireAdminTab,
} from "../middleware/auth.middleware.js";
import { adminModerationRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();
const adminGate = [isAuthenticated, authorize("admin"), requireAdminTab("freelistings")];

router.get("/admin/free-listings", ...adminGate, listAdminFreeListings);
router.get("/admin/free-listings/:id", ...adminGate, getAdminFreeListing);
router.patch("/admin/free-listings/:id", ...adminGate, updateAdminFreeListing);
router.post("/admin/free-listings/:id/remove", ...adminGate, removeAdminFreeListing);
router.post("/admin/free-listings/:id/restore", ...adminGate, restoreAdminFreeListing);
router.post(
  "/admin/free-listings/:id/warn",
  ...adminGate,
  adminModerationRateLimit,
  warnFreeListingSeller
);

export default router;
