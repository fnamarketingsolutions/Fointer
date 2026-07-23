import express from "express";
import {
  createCommunity,
  listMyCommunities,
  listAllCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityManage,
  listJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
} from "../controllers/community.controller.js";
import { isAuthenticated, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, createCommunity);
router.get("/mine", isAuthenticated, listMyCommunities);
router.get("/", isAuthenticated, authorize("admin"), listAllCommunities);
router.get("/:id/manage", isAuthenticated, getCommunityManage);
router.get("/:id/join-requests", isAuthenticated, listJoinRequests);
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
