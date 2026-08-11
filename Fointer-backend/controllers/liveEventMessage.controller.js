import LiveEventMember from "../models/liveEventMember.js";
import { getIo } from "../sockets/initSocket.js";
import {
  ensureActiveMembership,
  ensureChatAccess,
  formatMessage,
  formatUser,
  MESSAGE_EDIT_WINDOW_MINUTES,
  parsePagination,
  LiveEventMessage,
} from "../services/liveEventMessage.service.js";
import {
  LIVE_EVENT_SOCKET_EVENTS,
  toLiveEventRoom,
} from "../sockets/events.js";

const emitMessageEvent = (eventName, eventId, payload) => {
  const io = getIo();
  if (!io) return;
  const roomId = String(eventId);
  io.to(toLiveEventRoom(roomId)).emit(eventName, {
    ...payload,
    eventId: roomId,
  });
};

const canEditMessage = (message, userId) => {
  if (String(message.author) !== String(userId)) return false;
  const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
  return elapsedMs <= MESSAGE_EDIT_WINDOW_MINUTES * 60 * 1000;
};

const formatOpts = (access) => ({
  canModerate: Boolean(access.canModerate),
});

export const getLiveEventChatMeta = async (req, res) => {
  try {
    const { eventId } = req.params;
    const access = await ensureChatAccess(eventId, req.user);
    if (!access.ok) {
      return res
        .status(access.code)
        .json({ success: false, message: access.message });
    }

    const members = await LiveEventMember.find({
      liveEvent: eventId,
      status: "active",
    })
      .populate("user", "username name avatar")
      .sort({ createdAt: 1 })
      .lean();

    const memberList = members
      .filter((row) => row.user)
      .map((row) => ({
        id: row.user._id,
        username: row.user.username,
        name: row.user.name,
        avatar: row.user.avatar || "",
        role: row.role,
      }));

    const canManageEvent =
      access.canModerate || req.user.role === "admin";

    return res.status(200).json({
      success: true,
      chatMeta: {
        event: {
          id: access.event._id,
          shortCode: access.event.shortCode || null,
          title: access.event.title,
          category: access.event.category,
          access: access.event.access,
          status: access.event.status,
          community: access.event.community
            ? {
                id: access.event.community._id,
                shortCode: access.event.community.shortCode || null,
                name: access.event.community.name,
              }
            : null,
        },
        administrator: formatUser(access.event.createdBy),
        members: memberList,
        memberCount: memberList.length,
        myRole: access.membership?.role || null,
        canManageEvent,
        canModerateCommunity: Boolean(access.canModerate),
        isEnded: access.event.status === "ended",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listLiveEventMessages = async (req, res) => {
  try {
    const { eventId } = req.params;
    const access = await ensureChatAccess(eventId, req.user);
    if (!access.ok) {
      return res
        .status(access.code)
        .json({ success: false, message: access.message });
    }

    const { limit, before } = parsePagination(req.query);
    const query = { liveEvent: eventId };
    if (before) {
      query.createdAt = { $lt: before };
    }

    const rows = await LiveEventMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("author", "username name avatar")
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const ordered = [...slice].reverse();
    const nextCursor = hasMore ? slice[slice.length - 1]?.createdAt : null;

    return res.status(200).json({
      success: true,
      messages: ordered.map((row) =>
        formatMessage(row, req.user._id, formatOpts(access))
      ),
      pagination: {
        hasMore,
        nextCursor,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createLiveEventMessage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const access = await ensureActiveMembership(eventId, req.user._id);
    if (!access.ok) {
      return res
        .status(access.code)
        .json({ success: false, message: access.message });
    }

    if (access.event.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This live event has ended.",
      });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message text is required.",
      });
    }

    const created = await LiveEventMessage.create({
      liveEvent: eventId,
      author: req.user._id,
      text,
    });

    const populated = await LiveEventMessage.findById(created._id)
      .populate("author", "username name avatar")
      .lean();

    const chatAccess = await ensureChatAccess(eventId, req.user);
    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(chatAccess.ok ? chatAccess : { canModerate: false })
    );
    emitMessageEvent(LIVE_EVENT_SOCKET_EVENTS.MESSAGE_CREATED, eventId, {
      eventId,
      message,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLiveEventMessage = async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const access = await ensureActiveMembership(eventId, req.user._id);
    if (!access.ok) {
      return res
        .status(access.code)
        .json({ success: false, message: access.message });
    }

    const existing = await LiveEventMessage.findOne({
      _id: messageId,
      liveEvent: eventId,
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found." });
    }
    if (existing.status === "deleted") {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be edited.",
      });
    }
    if (!canEditMessage(existing, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Messages can only be edited by the author within 60 minutes.",
        editWindowMinutes: MESSAGE_EDIT_WINDOW_MINUTES,
      });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message text is required.",
      });
    }

    existing.text = text;
    existing.editedAt = new Date();
    await existing.save();

    const populated = await LiveEventMessage.findById(existing._id)
      .populate("author", "username name avatar")
      .lean();
    const chatAccess = await ensureChatAccess(eventId, req.user);
    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(chatAccess.ok ? chatAccess : { canModerate: false })
    );

    emitMessageEvent(LIVE_EVENT_SOCKET_EVENTS.MESSAGE_UPDATED, eventId, {
      eventId,
      message,
    });

    return res.status(200).json({
      success: true,
      message: "Message updated successfully.",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const softDeleteLiveEventMessage = async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const access = await ensureChatAccess(eventId, req.user);
    if (!access.ok) {
      return res
        .status(access.code)
        .json({ success: false, message: access.message });
    }

    if (!access.canModerate && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only community owners or moderators can remove live event messages.",
      });
    }

    const existing = await LiveEventMessage.findOne({
      _id: messageId,
      liveEvent: eventId,
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found." });
    }
    if (existing.status === "deleted") {
      const populated = await LiveEventMessage.findById(existing._id)
        .populate("author", "username name avatar")
        .lean();
      return res.status(200).json({
        success: true,
        message: "Message already deleted.",
        data: formatMessage(populated, req.user._id, formatOpts(access)),
      });
    }

    existing.status = "deleted";
    existing.deletedAt = new Date();
    existing.deletedBy = req.user._id;
    existing.text = "";
    await existing.save();

    const populated = await LiveEventMessage.findById(existing._id)
      .populate("author", "username name avatar")
      .lean();
    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(access)
    );

    emitMessageEvent(LIVE_EVENT_SOCKET_EVENTS.MESSAGE_DELETED, eventId, {
      eventId,
      message,
    });

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
