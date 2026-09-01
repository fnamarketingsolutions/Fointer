import express from "express";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listNotifications);
router.get("/unread-count", isAuthenticated, getUnreadCount);
router.post("/read-all", isAuthenticated, markAllNotificationsRead);
router.patch("/:id/read", isAuthenticated, markNotificationRead);
router.patch("/:id/unread", isAuthenticated, markNotificationUnread);
router.delete("/:id", isAuthenticated, deleteNotification);

export default router;
