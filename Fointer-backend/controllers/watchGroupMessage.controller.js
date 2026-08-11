import WatchGroupMember from "../models/watchGroupMember.js";
import { getIo } from "../sockets/initSocket.js";
import {
  ensureActiveMembership,
  ensureChatAccess,
  formatMessage,
  formatUser,
  isGroupAdmin,
  MESSAGE_EDIT_WINDOW_MINUTES,
  parsePagination,
  WatchGroupMessage,
} from "../services/watchGroupMessage.service.js";
import { WATCH_GROUP_SOCKET_EVENTS, toWatchGroupRoom } from "../sockets/events.js";

const emitMessageEvent = (eventName, groupId, payload) => {
  const io = getIo();
  if (!io) return;
  const roomId = String(groupId);
  io.to(toWatchGroupRoom(roomId)).emit(eventName, {
    ...payload,
    groupId: roomId,
  });
};

const canEditMessage = (message, userId) => {
  if (String(message.author) !== String(userId)) return false;
  const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
  return elapsedMs <= MESSAGE_EDIT_WINDOW_MINUTES * 60 * 1000;
};

const canDeleteMessage = (message, userId, group, membership) => {
  if (isGroupAdmin(group, membership, userId)) return true;
  return canEditMessage(message, userId);
};

const formatOpts = (access, userId) => ({
  isGroupAdmin: isGroupAdmin(access.group, access.membership, userId),
});

export const getWatchGroupChatMeta = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureChatAccess(groupId, req.user);
    if (!access.ok) {
      return res.status(access.code).json({ success: false, message: access.message });
    }

    const members = await WatchGroupMember.find({
      watchGroup: groupId,
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

    const canManageGroup =
      isGroupAdmin(access.group, access.membership, req.user._id) ||
      access.canModerate ||
      req.user.role === "admin";

    return res.status(200).json({
      success: true,
      chatMeta: {
        group: {
          id: access.group._id,
          shortCode: access.group.shortCode || null,
          name: access.group.name,
          type: access.group.type,
          status: access.group.status,
          community: access.group.community
            ? {
                id: access.group.community._id,
                shortCode: access.group.community.shortCode || null,
                name: access.group.community.name,
              }
            : null,
        },
        administrator: formatUser(access.group.createdBy),
        members: memberList,
        memberCount: memberList.length,
        myRole: access.membership?.role || null,
        canManageGroup,
        canModerateCommunity: Boolean(access.canModerate),
        isPaused: access.group.status === "paused",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listWatchGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureChatAccess(groupId, req.user);
    if (!access.ok) {
      return res.status(access.code).json({ success: false, message: access.message });
    }

    const { limit, before } = parsePagination(req.query);
    const query = { watchGroup: groupId };
    if (before) {
      query.createdAt = { $lt: before };
    }

    const rows = await WatchGroupMessage.find(query)
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
        formatMessage(row, req.user._id, formatOpts(access, req.user._id))
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

export const createWatchGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureActiveMembership(groupId, req.user._id);
    if (!access.ok) {
      return res.status(access.code).json({ success: false, message: access.message });
    }

    if (access.group.status === "paused") {
      return res.status(403).json({
        success: false,
        message: "This watch group is paused.",
      });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message text is required.",
      });
    }

    const created = await WatchGroupMessage.create({
      watchGroup: groupId,
      author: req.user._id,
      text,
    });

    const populated = await WatchGroupMessage.findById(created._id)
      .populate("author", "username name avatar")
      .lean();

    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(access, req.user._id)
    );
    emitMessageEvent(WATCH_GROUP_SOCKET_EVENTS.MESSAGE_CREATED, groupId, {
      groupId,
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

export const updateWatchGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const access = await ensureActiveMembership(groupId, req.user._id);
    if (!access.ok) {
      return res.status(access.code).json({ success: false, message: access.message });
    }

    const existing = await WatchGroupMessage.findOne({
      _id: messageId,
      watchGroup: groupId,
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Message not found." });
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

    const populated = await WatchGroupMessage.findById(existing._id)
      .populate("author", "username name avatar")
      .lean();
    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(access, req.user._id)
    );

    emitMessageEvent(WATCH_GROUP_SOCKET_EVENTS.MESSAGE_UPDATED, groupId, {
      groupId,
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

export const softDeleteWatchGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const access = await ensureChatAccess(groupId, req.user);
    if (!access.ok) {
      return res.status(access.code).json({ success: false, message: access.message });
    }

    const existing = await WatchGroupMessage.findOne({
      _id: messageId,
      watchGroup: groupId,
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }
    if (existing.status === "deleted") {
      const populated = await WatchGroupMessage.findById(existing._id)
        .populate("author", "username name avatar")
        .lean();
      return res.status(200).json({
        success: true,
        message: "Message already deleted.",
        data: formatMessage(
          populated,
          req.user._id,
          formatOpts(access, req.user._id)
        ),
      });
    }
    if (
      !canDeleteMessage(
        existing,
        req.user._id,
        access.group,
        access.membership
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Messages can only be deleted by the author within 60 minutes, or by the group administrator.",
        editWindowMinutes: MESSAGE_EDIT_WINDOW_MINUTES,
      });
    }

    existing.status = "deleted";
    existing.deletedAt = new Date();
    existing.deletedBy = req.user._id;
    existing.text = "";
    await existing.save();

    const populated = await WatchGroupMessage.findById(existing._id)
      .populate("author", "username name avatar")
      .lean();
    const message = formatMessage(
      populated,
      req.user._id,
      formatOpts(access, req.user._id)
    );

    emitMessageEvent(WATCH_GROUP_SOCKET_EVENTS.MESSAGE_DELETED, groupId, {
      groupId,
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
