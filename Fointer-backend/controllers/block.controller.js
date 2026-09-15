import User from "../models/user.js";
import UserBlock from "../models/userBlock.js";
import { sendServerError } from "../utils/safeError.js";
import { normalizeUsername } from "./user.controller.js";
import { parseObjectIdInput } from "../utils/shortCode.js";

const formatBlockedUser = (user) => ({
  id: String(user._id),
  username: user.username,
  name: user.name,
  avatar: user.avatar || "",
});

export const isMessagingBlocked = async (userA, userB) => {
  if (!userA || !userB) return false;
  const a = String(userA);
  const b = String(userB);
  if (a === b) return false;
  const row = await UserBlock.findOne({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  })
    .select("_id blocker")
    .lean();
  return Boolean(row);
};

export const getBlockState = async (viewerId, otherId) => {
  if (!viewerId || !otherId) {
    return { isBlocked: false, blockedByMe: false };
  }
  const viewer = String(viewerId);
  const other = String(otherId);
  if (viewer === other) {
    return { isBlocked: false, blockedByMe: false };
  }
  const rows = await UserBlock.find({
    $or: [
      { blocker: viewer, blocked: other },
      { blocker: other, blocked: viewer },
    ],
  })
    .select("blocker blocked")
    .lean();

  if (!rows.length) {
    return { isBlocked: false, blockedByMe: false };
  }

  const blockedByMe = rows.some(
    (row) =>
      String(row.blocker) === viewer && String(row.blocked) === other
  );
  return { isBlocked: true, blockedByMe };
};

export const listBlockedUsers = async (req, res) => {
  try {
    const rows = await UserBlock.find({ blocker: req.user._id })
      .sort({ createdAt: -1 })
      .populate("blocked", "username name avatar")
      .lean();

    const users = rows
      .map((row) => row.blocked)
      .filter(Boolean)
      .map(formatBlockedUser);

    return res.json({ success: true, users });
  } catch (error) {
    return sendServerError(res, error, "Failed to load blocked users.");
  }
};
 
const resolveTargetUser = async (req) => {
  const username = normalizeUsername(
    req.params.username || req.body?.username
  );
  const parsedUserId = parseObjectIdInput(
    req.params.userId || req.body?.userId
  );

  if (parsedUserId) {
    return User.findById(parsedUserId).select("username name avatar status");
  }
  if (username) {
    return User.findOne({ username }).select("username name avatar status");
  }
  return null;
};

export const blockUser = async (req, res) => {
  try {
    const target = await resolveTargetUser(req);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself.",
      });
    }

    await UserBlock.updateOne(
      { blocker: req.user._id, blocked: target._id },
      { $setOnInsert: { blocker: req.user._id, blocked: target._id } },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: "User blocked.",
      user: formatBlockedUser(target),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to block user.");
  }
};

export const unblockUser = async (req, res) => {
  try {
    const target = await resolveTargetUser(req);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await UserBlock.deleteOne({
      blocker: req.user._id,
      blocked: target._id,
    });

    return res.json({
      success: true,
      message: "User unblocked.",
      user: formatBlockedUser(target),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to unblock user.");
  }
};