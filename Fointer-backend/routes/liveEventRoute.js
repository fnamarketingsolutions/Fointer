import express from "express";
import {
  listLiveEvents,
  getLiveEvent,
  createLiveEvent,
  endLiveEvent,
  deleteLiveEvent,
  listLiveMessages,
  deleteLiveMessage,
  listHostableCommunities,
} from "../controllers/liveEvent.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/hostable-communities", isAuthenticated, listHostableCommunities);
router.get("/", isAuthenticated, listLiveEvents);
router.post("/", isAuthenticated, createLiveEvent);

router.get("/:id/messages", isAuthenticated, listLiveMessages);
router.delete("/:id/messages/:messageId", isAuthenticated, deleteLiveMessage);

router.post("/:id/end", isAuthenticated, endLiveEvent);
router.get("/:id", isAuthenticated, getLiveEvent);
router.delete("/:id", isAuthenticated, deleteLiveEvent);

export default router;
