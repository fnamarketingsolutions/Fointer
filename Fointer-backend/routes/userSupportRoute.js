import express from "express";
import {
  listPublicCategories,
  createPublicRequest,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  listAdminRequests,
  updateAdminRequestStatus,
} from "../controllers/userSupport.controller.js";
import {
  isAuthenticated,
  authorize,
  optionalAuthenticate,
  requireAdminTab,
} from "../middleware/auth.middleware.js";
import { memberReportRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

const adminGate = [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("usersupport"),
];

router.get("/user-support/categories", listPublicCategories);
router.post(
  "/user-support/requests",
  optionalAuthenticate,
  memberReportRateLimit,
  createPublicRequest
);

router.get("/admin/user-support/categories", ...adminGate, listAdminCategories);
router.post("/admin/user-support/categories", ...adminGate, createAdminCategory);
router.patch(
  "/admin/user-support/categories/:id",
  ...adminGate,
  updateAdminCategory
);
router.get("/admin/user-support/requests", ...adminGate, listAdminRequests);
router.patch(
  "/admin/user-support/requests/:id/status",
  ...adminGate,
  updateAdminRequestStatus
);

export default router;
