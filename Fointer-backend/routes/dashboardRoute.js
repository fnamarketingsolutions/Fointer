import express from "express";
import {
  listUsers,
  updateUserStatus,
  getAdminUserDetail,
  getAdminCommunityDetail,
} from "../controllers/dashboard.controller.js";
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
import { isAuthenticated, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/site/contact", getPublicSiteContact);

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

router.get(
  "/admin/live-events",
  isAuthenticated,
  authorize("admin"),
  adminListLiveEvents
);

router.get(
  "/admin/live-events/:id",
  isAuthenticated,
  authorize("admin"),
  getLiveEvent
);

router.post(
  "/admin/live-events/:id/end",
  isAuthenticated,
  authorize("admin"),
  endLiveEvent
);

router.delete(
  "/admin/live-events/:id",
  isAuthenticated,
  authorize("admin"),
  deleteLiveEvent
);

router.get(
  "/admin/live-events/:id/messages",
  isAuthenticated,
  authorize("admin"),
  listLiveMessages
);

router.delete(
  "/admin/live-events/:id/messages/:messageId",
  isAuthenticated,
  authorize("admin"),
  deleteLiveMessage
);

router.get(
  "/admin/watch-groups",
  isAuthenticated,
  authorize("admin"),
  adminListWatchGroups
);

router.get(
  "/admin/watch-groups/:id",
  isAuthenticated,
  authorize("admin"),
  getWatchGroup
);

router.delete(
  "/admin/watch-groups/:id",
  isAuthenticated,
  authorize("admin"),
  deleteWatchGroup
);

router.get(
  "/admin/watch-groups/:id/messages",
  isAuthenticated,
  authorize("admin"),
  listWatchMessages
);

router.delete(
  "/admin/watch-groups/:id/messages/:messageId",
  isAuthenticated,
  authorize("admin"),
  deleteWatchMessage
);

router.get(
  "/admin/watch-groups/:id/participants",
  isAuthenticated,
  authorize("admin"),
  listParticipants
);

router.delete(
  "/admin/watch-groups/:id/participants/:memberId",
  isAuthenticated,
  authorize("admin"),
  removeParticipant
);

router.get(
  "/admin/moderation/posts",
  isAuthenticated,
  authorize("admin"),
  adminListModerationPosts
);

router.delete(
  "/admin/moderation/posts/:id",
  isAuthenticated,
  authorize("admin"),
  deletePost
);

router.get(
  "/admin/moderation/comments",
  isAuthenticated,
  authorize("admin"),
  adminListModerationComments
);

router.delete(
  "/admin/moderation/comments/:id",
  isAuthenticated,
  authorize("admin"),
  deleteComment
);

router.get(
  "/admin/reports",
  isAuthenticated,
  authorize("admin"),
  listAdminReports
);

router.patch(
  "/admin/reports/:id",
  isAuthenticated,
  authorize("admin"),
  updateAdminReport
);

router.get(
  "/admin/analytics",
  isAuthenticated,
  authorize("admin"),
  getReportingAnalytics
);

router.get(
  "/admin/marketplace/listings",
  isAuthenticated,
  authorize("admin"),
  listAdminListings
);
router.get(
  "/admin/marketplace/listings/:id",
  isAuthenticated,
  authorize("admin"),
  getAdminListing
);
router.patch(
  "/admin/marketplace/listings/:id",
  isAuthenticated,
  authorize("admin"),
  updateAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/remove",
  isAuthenticated,
  authorize("admin"),
  removeAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/restore",
  isAuthenticated,
  authorize("admin"),
  restoreAdminListing
);
router.post(
  "/admin/marketplace/listings/:id/warn",
  isAuthenticated,
  authorize("admin"),
  warnListingSeller
);
router.get(
  "/admin/users/:userId/listings",
  isAuthenticated,
  authorize("admin"),
  listAdminUserListings
);
router.get(
  "/admin/marketplace/reported-conversations",
  isAuthenticated,
  authorize("admin"),
  listReportedConversations
);
router.get(
  "/admin/conversations/:id/messages",
  isAuthenticated,
  authorize("admin"),
  getAdminConversationMessages
);

export default router;
