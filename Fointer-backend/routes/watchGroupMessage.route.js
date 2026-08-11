import express from "express";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import {
  createWatchGroupMessage,
  getWatchGroupChatMeta,
  listWatchGroupMessages,
  softDeleteWatchGroupMessage,
  updateWatchGroupMessage,
} from "../controllers/watchGroupMessage.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/chat-meta", isAuthenticated, getWatchGroupChatMeta);
router.get("/messages", isAuthenticated, listWatchGroupMessages);
router.post("/messages", isAuthenticated, createWatchGroupMessage);
router.patch("/messages/:messageId", isAuthenticated, updateWatchGroupMessage);
router.delete("/messages/:messageId", isAuthenticated, softDeleteWatchGroupMessage);

export default router;
