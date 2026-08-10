import express from "express";
import {
  listWatchGroups,
  getWatchGroup,
  createWatchGroup,
  joinWatchGroup,
  leaveWatchGroup,
  deleteWatchGroup,
  listParticipants,
  removeParticipant,
  addParticipant,
  setParticipantRole,
  listWatchMessages,
  deleteWatchMessage,
} from "../controllers/watchGroup.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listWatchGroups);
router.post("/", isAuthenticated, createWatchGroup);

router.get("/:id/participants", isAuthenticated, listParticipants);
router.post("/:id/participants", isAuthenticated, addParticipant);
router.delete("/:id/participants/:memberId", isAuthenticated, removeParticipant);
router.patch(
  "/:id/participants/:memberId/role",
  isAuthenticated,
  setParticipantRole
);

router.get("/:id/messages", isAuthenticated, listWatchMessages);
router.delete("/:id/messages/:messageId", isAuthenticated, deleteWatchMessage);

router.post("/:id/join", isAuthenticated, joinWatchGroup);
router.post("/:id/leave", isAuthenticated, leaveWatchGroup);

router.get("/:id", isAuthenticated, getWatchGroup);
router.delete("/:id", isAuthenticated, deleteWatchGroup);

export default router;
