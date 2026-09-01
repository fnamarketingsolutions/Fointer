import mongoose from "mongoose";
import Notification, {
  ADMIN_NOTIFICATION_TYPES,
  SYSTEM_NOTIFICATION_TYPES,
} from "../models/notification.js";
import { formatNotification } from "../utils/notify.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { sendServerError } from "../utils/safeError.js";

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const isAdminRole = (user) => String(user?.role || "").toLowerCase() === "admin";

const recipientScope = (user) => {
  const query = { recipient: user._id };
  if (isAdminRole(user)) {
    query.type = { $in: ADMIN_NOTIFICATION_TYPES };
  }
  return query;
};

const ownedNotification = async (id, userId) => {
  if (!isValidId(id)) return null;
  return Notification.findOne({
    _id: id,
    recipient: userId,
  });
};

export const listNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const filter = String(req.query.filter || "all").toLowerCase();
    const query = recipientScope(req.user);

    if (isAdminRole(req.user)) {
      if (filter === "unread") {
        query.readAt = null;
      } else if (filter === "reports") {
        query.type = "content_report";
      } else if (filter === "requests" || filter === "channel") {
        query.type = "channel_request";
      }
    } else if (filter === "unread") {
      query.readAt = null;
    } else if (filter === "mentions") {
      query.type = "mention";
    } else if (filter === "system") {
      query.type = { $in: SYSTEM_NOTIFICATION_TYPES };
    }

    const unreadQuery = {
      ...recipientScope(req.user),
      readAt: null,
    };

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments(unreadQuery),
    ]);

    return res.status(200).json({
      success: true,
      notifications: items.map(formatNotification),
      unreadCount,
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      ...recipientScope(req.user),
      readAt: null,
    });
    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await ownedNotification(req.params.id, req.user._id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      notification: formatNotification(notification),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const markNotificationUnread = async (req, res) => {
  try {
    const notification = await ownedNotification(req.params.id, req.user._id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    notification.readAt = null;
    await notification.save();

    return res.status(200).json({
      success: true,
      notification: formatNotification(notification),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { ...recipientScope(req.user), readAt: null },
      { $set: { readAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      updated: result.modifiedCount || 0,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await ownedNotification(req.params.id, req.user._id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    const wasUnread = !notification.readAt;
    await notification.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Notification deleted.",
      wasUnread,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
