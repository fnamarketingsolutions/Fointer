import express from "express";
import {
  getOverview,
  listUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
  listUserActivity,
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
  "/admin/users/:id",
  isAuthenticated,
  authorize("admin"),
  updateUser
);

router.post(
  "/admin/users/:id/reset-password",
  isAuthenticated,
  authorize("admin"),
  resetUserPassword
);

router.get(
  "/admin/users/:id/activity",
  isAuthenticated,
  authorize("admin"),
  listUserActivity
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

router.delete(
  "/admin/users/:id",
  isAuthenticated,
  authorize("admin"),
  deleteUser
);

export default router;
