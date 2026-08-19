import express from "express";
import {
  createCommunity,
  listMyCommunities,
  listAllCommunities,
  listJoinedCommunities,
  listDiscoverCommunities,
  listBrowsableCommunities,
  getBrowsableCommunity,
  listBrowsableCommunityMembers,
  listMyJoinRequests,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityManage,
  listJoinRequests,
  createJoinRequest,
  joinPublicCommunity,
  createCommunityInvite,
  listMyInvites,
  listCommunityInvites,
  acceptCommunityInvite,
  declineCommunityInvite,
  resolveCommunityCode,
} from "../controllers/community.controller.js";
import {
  listCommunityMembers,
  assignModerator,
  revokeModerator,
  listModerators,
  removeMemberRole,
  banMember,
  unbanMember,
  approveJoinRequest,
  denyJoinRequest,
} from "../controllers/moderator.controller.js";
import {
  isAuthenticated,
  authorize,
  optionalAuthenticate,
} from "../middleware/auth.middleware.js";
import inviteRoute from "./inviteRoute.js";

const router = express.Router();

// Short-code lookup — must stay ahead of the /:id routes
router.get("/resolve/:code", optionalAuthenticate, resolveCommunityCode);

router.get("/browse", optionalAuthenticate, listBrowsableCommunities);
router.get("/browse/:id/members", isAuthenticated, listBrowsableCommunityMembers);
router.get("/browse/:id", optionalAuthenticate, getBrowsableCommunity);

router.post("/", isAuthenticated, createCommunity);
router.get("/mine", isAuthenticated, listMyCommunities);
router.get("/joined", isAuthenticated, listJoinedCommunities);
router.get("/discover", isAuthenticated, listDiscoverCommunities);
router.get("/join-requests/mine", isAuthenticated, listMyJoinRequests);
router.get("/invites/mine", isAuthenticated, listMyInvites);
router.post("/invites/:inviteId/accept", isAuthenticated, acceptCommunityInvite);
router.post("/invites/:inviteId/decline", isAuthenticated, declineCommunityInvite);
router.get("/", isAuthenticated, authorize("admin"), listAllCommunities);
router.get("/:id/manage", isAuthenticated, getCommunityManage);
router.get("/:id/members", isAuthenticated, listCommunityMembers);
router.post("/:id/moderators", isAuthenticated, assignModerator);
router.get("/:id/moderators", isAuthenticated, listModerators);
router.delete("/:id/moderators/:userId", isAuthenticated, revokeModerator);
router.delete("/:id/members/:memberId", isAuthenticated, removeMemberRole);
router.post("/:id/members/:memberId/ban", isAuthenticated, banMember);
router.post("/:id/members/:memberId/unban", isAuthenticated, unbanMember);
router.get("/:id/join-requests", isAuthenticated, listJoinRequests);
router.post("/:id/join-requests", isAuthenticated, createJoinRequest);
router.post("/:id/join", isAuthenticated, joinPublicCommunity);
router.get("/:id/invites", isAuthenticated, listCommunityInvites);
router.post("/:id/invites", isAuthenticated, createCommunityInvite);
router.use("/:id/invite-user", inviteRoute);
router.post(
  "/:id/join-requests/:requestId/approve",
  isAuthenticated,
  approveJoinRequest
);
router.post(
  "/:id/join-requests/:requestId/deny",
  isAuthenticated,
  denyJoinRequest
);
router.get("/:id", isAuthenticated, getCommunity);
router.patch("/:id", isAuthenticated, updateCommunity);
router.delete("/:id", isAuthenticated, deleteCommunity);

export default router;
