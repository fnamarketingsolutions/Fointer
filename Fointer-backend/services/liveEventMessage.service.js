import LiveEvent from "../models/liveEvent.js";
import LiveEventMember from "../models/liveEventMember.js";
import LiveEventMessage from "../models/liveEventMessage.js";
import { canModerateCommunity } from "../utils/communityPermissions.js";

export const MESSAGE_EDIT_WINDOW_MINUTES = 60;
const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 100;

export const formatUser = (user) => {
  if (!user || typeof user !== "object") return null;
  return {
    id: user._id || user.id,
    username: user.username || "",
    name: user.name || "",
    avatar: user.avatar || "",
  };
};

export const formatMessage = (message, viewerId, options = {}) => {
  const isDeleted = message.status === "deleted";
  const isAuthor =
    String(message.author?._id || message.author) === String(viewerId);
  const withinWindow =
    Date.now() - new Date(message.createdAt).getTime() <=
    MESSAGE_EDIT_WINDOW_MINUTES * 60 * 1000;
  const canModerate = Boolean(options.canModerate);
  const canEdit = !isDeleted && isAuthor && withinWindow;
  // Only community owner/moderator can delete messages (moderate live event)
  const canDelete = !isDeleted && canModerate;

  return {
    id: message._id,
    liveEvent: message.liveEvent,
    author: formatUser(message.author),
    text: isDeleted ? "" : message.text || "",
    status: message.status,
    deletedAt: message.deletedAt || null,
    deletedBy: message.deletedBy || null,
    editedAt: message.editedAt || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    canEdit,
    canDelete,
    editWindowMinutes: MESSAGE_EDIT_WINDOW_MINUTES,
  };
};

const getCommunityRef = (event) => {
  if (!event?.community) return null;
  if (event.community._id) return event.community;
  return { _id: event.community };
};

export const resolveCommunityModeration = async (event, user) => {
  const community = getCommunityRef(event);
  if (!community?._id) return false;
  return canModerateCommunity(community, user);
};

/**
 * Active event member required (for send / edit).
 */
export const ensureActiveMembership = async (eventId, userId) => {
  const [event, membership] = await Promise.all([
    LiveEvent.findOne({ _id: eventId, status: "active" })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean(),
    LiveEventMember.findOne({
      liveEvent: eventId,
      user: userId,
      status: "active",
    }).lean(),
  ]);

  if (!event) {
    return { ok: false, code: 404, message: "Live event not found." };
  }
  if (!membership) {
    return {
      ok: false,
      code: 403,
      message: "Only live event members can access chat.",
    };
  }

  return { ok: true, event, membership };
};

/**
 * Member OR community moderator may read chat.
 */
export const ensureChatAccess = async (eventId, user) => {
  const [event, membership] = await Promise.all([
    LiveEvent.findOne({ _id: eventId, status: { $in: ["active", "ended"] } })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean(),
    LiveEventMember.findOne({
      liveEvent: eventId,
      user: user._id,
      status: "active",
    }).lean(),
  ]);

  if (!event) {
    return { ok: false, code: 404, message: "Live event not found." };
  }

  const canModerate = await resolveCommunityModeration(event, user);
  if (!membership && !canModerate) {
    return {
      ok: false,
      code: 403,
      message: "Only live event members can access chat.",
    };
  }

  return {
    ok: true,
    event,
    membership: membership || null,
    canModerate,
  };
};

export const parsePagination = (query = {}) => {
  const raw = Number(query.limit);
  const limit = Number.isFinite(raw)
    ? Math.max(1, Math.min(MAX_PAGE_LIMIT, Math.floor(raw)))
    : DEFAULT_PAGE_LIMIT;
  const before = query.before ? new Date(query.before) : null;
  return {
    limit,
    before: before && !Number.isNaN(before.getTime()) ? before : null,
  };
};

export { LiveEventMessage };
