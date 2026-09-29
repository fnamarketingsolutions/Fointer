import express from "express";
import {
  listConversations,
  getUnreadTotal,
  createConversation,
  getConversation,
  listMessages,
  postMessage,
  markConversationRead,
  deleteConversation,
  updateMessage,
  deleteMessage,
} from "../controllers/conversation.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import {
  dmCreateRateLimit,
  dmSendRateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listConversations);
router.get("/unread-total", isAuthenticated, getUnreadTotal);
router.post("/", isAuthenticated, dmCreateRateLimit, createConversation);

router.get("/:id/messages", isAuthenticated, listMessages);
router.post("/:id/messages", isAuthenticated, dmSendRateLimit, postMessage);
router.patch("/:id/messages/:messageId", isAuthenticated, updateMessage);
router.delete("/:id/messages/:messageId", isAuthenticated, deleteMessage);
router.patch("/:id/read", isAuthenticated, markConversationRead);
router.delete("/:id", isAuthenticated, deleteConversation);

router.get("/:id", isAuthenticated, getConversation);

export default router;
