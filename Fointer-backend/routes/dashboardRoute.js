import express from "express";
import {
  listUsers,
  updateUserStatus,
  getAdminUserDetail,
  getAdminCommunityDetail,
} from "../controllers/dashboard.controller.js";
import {
  listAdmins,
  createAdmin,
  updateAdminTabs,
  updateAdminSuper,
  promoteUserToAdmin,
} from "../controllers/adminManagement.controller.js";
import {
  getPublicSiteContact,
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/settings.controller.js";
import {
  adminListLiveEvents,
  endLiveEvent,
  deleteLiveEvent,
  listLiveMessages,
  deleteLiveMessage,
  getLiveEvent,
} from "../controllers/liveEvent.controller.js";
import {
  adminListWatchGroups,
  deleteWatchGroup,
  listWatchMessages,
  deleteWatchMessage,
  listParticipants,
  removeParticipant,
  getWatchGroup,
} from "../controllers/watchGroup.controller.js";
import {
  adminListModerationPosts,
  adminListModerationComments,
  deletePost,
  deleteComment,
} from "../controllers/post.controller.js";
import {
  listAdminReports,
  updateAdminReport,
  getReportingAnalytics,
} from "../controllers/report.controller.js";
import {
  listAdminListings,
  getAdminListing,
  updateAdminListing,
  removeAdminListing,
  restoreAdminListing,
  listAdminUserListings,
  listReportedConversations,
  getAdminConversationMessages,
  warnListingSeller,
} from "../controllers/adminMarketplace.controller.js";
import {
  listWarnings,
  createWarning,
  getWarningPolicySettings,
} from "../controllers/warning.controller.js";
import {
  isAuthenticated,
  authorize,
  requireAdminTab,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";
import { adminModerationRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

const adminGate = (tab) => [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab(tab),
];

const superAdminGate = [
  isAuthenticated,
  authorize("admin"),
  requireSuperAdmin,
];

router.get("/site/contact", getPublicSiteContact);

router.get("/admin/settings", ...adminGate("settings"), getSystemSettings);
router.patch(
  "/admin/settings",
  ...adminGate("settings"),
  updateSystemSettings
);

router.get("/admin/warnings", ...adminGate("warnings"), listWarnings);
router.get(
  "/admin/warnings/policy",
  isAuthenticated,
  authorize("admin"),
  // Readable by any tab that can issue warnings (not full System Settings).
  requireAdminTab("warnings", "users", "moderation", "marketplace"),
  getWarningPolicySettings
);
router.post(
  "/admin/warnings",
  isAuthenticated,
  authorize("admin"),
  // Generic warn-any-user: Warnings, Users, Content Moderation only.
  // Marketplace uses /admin/marketplace/listings/:id/warn (seller-scoped).
  requireAdminTab("warnings", "users", "moderation"),
  adminModerationRateLimit,
  createWarning
);

router.get("/admin/users", ...adminGate("users"), listUsers);
router.patch(
  "/admin/users/:id/status",
  ...adminGate("users"),
  updateUserStatus
);
router.get(
  "/admin/users/:id/detail",
  ...adminGate("users"),
  getAdminUserDetail
);

router.get(
  "/admin/communities/:id/detail",
  ...adminGate("communities"),
  getAdminCommunityDetail
);

router.get("/admin/admins", ...superAdminGate, listAdmins);
router.post("/admin/admins", ...superAdminGate, createAdmin);
router.patch(
  "/admin/admins/:id/tabs",
  ...superAdminGate,
  updateAdminTabs
);
router.patch(
  "/admin/admins/:id/super",
  ...superAdminGate,
  updateAdminSuper
);
router.post(
  "/admin/admins/:id/promote",
  ...superAdminGate,
  promoteUserToAdmin
);

router.get(
  "/admin/live-events",
  ...adminGate("commentary"),
  adminListLiveEvents
);
router.get(
  "/admin/live-events/:id",
  ...adminGate("commentary"),
  getLiveEvent
);
router.post(
  "/admin/live-events/:id/end",
  ...adminGate("commentary"),
  endLiveEvent
);
router.delete(
  "/admin/live-events/:id",
  ...adminGate("commentary"),
  deleteLiveEvent
);
router.get(
  "/admin/live-events/:id/messages",
  ...adminGate("commentary"),
  listLiveMessages
);
router.delete(
  "/admin/live-events/:id/messages/:messageId",
  ...adminGate("commentary"),
  deleteLiveMessage
);

router.get(
  "/admin/watch-groups",
  ...adminGate("watchgroups"),
  adminListWatchGroups
);
router.get(
  "/admin/watch-groups/:id",
  ...adminGate("watchgroups"),
  getWatchGroup
);
router.delete(
  "/admin/watch-groups/:id",
  ...adminGate("watchgroups"),
  deleteWatchGroup
);
router.get(
  "/admin/watch-groups/:id/messages",
  ...adminGate("watchgroups"),
  listWatchMessages
);
router.delete(
  "/admin/watch-groups/:id/messages/:messageId",
  ...adminGate("watchgroups"),
  deleteWatchMessage
);
router.get(
  "/admin/watch-groups/:id/participants",
  ...adminGate("watchgroups"),
  listParticipants
);
router.delete(
  "/admin/watch-groups/:id/participants/:memberId",
  ...adminGate("watchgroups"),
  removeParticipant
);

router.get(
  "/admin/moderation/posts",
  ...adminGate("moderation"),
  adminListModerationPosts
);
router.delete(
  "/admin/moderation/posts/:id",
  ...adminGate("moderation"),
  deletePost
);
router.get(
  "/admin/moderation/comments",
  ...adminGate("moderation"),
  adminListModerationComments
);
router.delete(
  "/admin/moderation/comments/:id",
  ...adminGate("moderation"),
  deleteComment
);
// Reports are owned by Reporting & Analytics (same as content_report notifications).
router.get("/admin/reports", ...adminGate("analytics"), listAdminReports);
router.patch(
  "/admin/reports/:id",
  ...adminGate("analytics"),
  adminModerationRateLimit,
  updateAdminReport
);

router.get(
  "/admin/analytics",
  ...adminGate("analytics"),
  getReportingAnalytics
);

router.get(
  "/admin/marketplace/listings",
  ...adminGate("marketplace"),
  listAdminListings
);
router.get(
  "/admin/marketplace/listings/:id",
  ...adminGate("marketplace"),
  getAdminListing
);
router.patch(
  "/admin/marketplace/listings/:id",
  ...adminGate("marketplace"),
  updateAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/remove",
  ...adminGate("marketplace"),
  removeAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/restore",
  ...adminGate("marketplace"),
  restoreAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/warn",
  ...adminGate("marketplace"),
  adminModerationRateLimit,
  warnListingSeller
);
router.get(
  "/admin/users/:userId/listings",
  ...adminGate("marketplace"),
  listAdminUserListings
);
router.get(
  "/admin/marketplace/reported-conversations",
  ...adminGate("marketplace"),
  listReportedConversations
);
router.get(
  "/admin/conversations/:id/messages",
  isAuthenticated,
  authorize("admin"),
  // Marketplace reported chats + Analytics conversation reports (+ moderation if reused).
  requireAdminTab("marketplace", "analytics", "moderation"),
  getAdminConversationMessages
);

export default router;
