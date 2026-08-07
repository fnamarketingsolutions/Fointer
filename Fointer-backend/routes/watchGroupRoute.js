import express from "express";
import {
  createWatchGroup,
  listWatchGroups,
  getWatchGroupCreateContext,
  joinWatchGroup,
  createWatchGroupJoinRequest,
  listWatchGroupJoinRequests,
  approveWatchGroupJoinRequest,
  denyWatchGroupJoinRequest,
  closeWatchGroup,
  removeWatchGroupMember,
} from "../controllers/watchGroup.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import watchGroupMessageRoute from "./watchGroupMessage.route.js";

const router = express.Router();

router.get("/create-context", isAuthenticated, getWatchGroupCreateContext);
router.get("/", isAuthenticated, listWatchGroups);
router.post("/", isAuthenticated, createWatchGroup);

router.post("/:groupId/join", isAuthenticated, joinWatchGroup);
router.get("/:groupId/join-requests", isAuthenticated, listWatchGroupJoinRequests);
router.post(
  "/:groupId/join-requests",
  isAuthenticated,
  createWatchGroupJoinRequest
);
router.post(
  "/:groupId/join-requests/:requestId/approve",
  isAuthenticated,
  approveWatchGroupJoinRequest
);
router.post(
  "/:groupId/join-requests/:requestId/deny",
  isAuthenticated,
  denyWatchGroupJoinRequest
);
router.delete("/:groupId/members/:userId", isAuthenticated, removeWatchGroupMember);
router.delete("/:groupId", isAuthenticated, closeWatchGroup);

router.use("/:groupId", watchGroupMessageRoute);

export default router;
