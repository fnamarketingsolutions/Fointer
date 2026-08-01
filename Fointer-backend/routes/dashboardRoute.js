import express from "express";
import {
  getOverview,
  listUsers,
  updateUserStatus,
  getAdminUserDetail,
  getAdminCommunityDetail,
} from "../controllers/dashboard.controller.js";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/settings.controller.js";
import { isAuthenticated, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard/overview", isAuthenticated, getOverview);

router.get(
  "/admin/settings",
  isAuthenticated,
  authorize("admin"),
  getSystemSettings
);

router.patch(
  "/admin/settings",
  isAuthenticated,
  authorize("admin"),
  updateSystemSettings
);

router.get(
  "/admin/users",
  isAuthenticated,
  authorize("admin"),
  listUsers
);

router.patch(
  "/admin/users/:id/status",
  isAuthenticated,
  authorize("admin"),
  updateUserStatus
);

router.get(
  "/admin/users/:id/detail",
  isAuthenticated,
  authorize("admin"),
  getAdminUserDetail
);

router.get(
  "/admin/communities/:id/detail",
  isAuthenticated,
  authorize("admin"),
  getAdminCommunityDetail
);

export default router;
