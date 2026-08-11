import express from "express";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import {
  createLiveEventMessage,
  getLiveEventChatMeta,
  listLiveEventMessages,
  softDeleteLiveEventMessage,
  updateLiveEventMessage,
} from "../controllers/liveEventMessage.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/chat-meta", isAuthenticated, getLiveEventChatMeta);
router.get("/messages", isAuthenticated, listLiveEventMessages);
router.post("/messages", isAuthenticated, createLiveEventMessage);
router.patch("/messages/:messageId", isAuthenticated, updateLiveEventMessage);
router.delete(
  "/messages/:messageId",
  isAuthenticated,
  softDeleteLiveEventMessage
);

export default router;
