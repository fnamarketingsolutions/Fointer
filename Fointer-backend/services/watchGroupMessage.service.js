import WatchGroup from "../models/watchGroup.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import WatchGroupMessage from "../models/watchGroupMessage.model.js";
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
  const isGroupCreator = Boolean(options.isGroupCreator);
  const canModerate = Boolean(options.canModerate);
  const canEdit = !isDeleted && isAuthor && withinWindow;
  const canDelete =
    !isDeleted &&
    ((isAuthor && withinWindow) || isGroupCreator || canModerate);

  return {
    id: message._id,
    watchGroup: message.watchGroup,
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

export const isWatchGroupCreator = (group, userId) => {
  const creatorId = group?.createdBy?._id || group?.createdBy;
  return Boolean(creatorId && String(creatorId) === String(userId));
};

export const isGroupAdmin = (group, membership, userId) => {
  if (isWatchGroupCreator(group, userId)) return true;
  return membership?.role === "owner" && membership?.status === "active";
};

const getCommunityRef = (group) => {
  if (!group?.community) return null;
  if (group.community._id) return group.community;
  return { _id: group.community };
};

export const resolveCommunityModeration = async (group, user) => {
  const community = getCommunityRef(group);
  if (!community?._id) return false;
  return canModerateCommunity(community, user);
};

/**
 * Active group member required (for send / edit).
 */
export const ensureActiveMembership = async (groupId, userId) => {
  const [group, membership] = await Promise.all([
    WatchGroup.findOne({ _id: groupId, status: "active" })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean(),
    WatchGroupMember.findOne({
      watchGroup: groupId,
      user: userId,
      status: "active",
    }).lean(),
  ]);

  if (!group) {
    return { ok: false, code: 404, message: "Watch group not found." };
  }
  if (!membership) {
    return {
      ok: false,
      code: 403,
      message: "Only watch group members can access chat.",
    };
  }

  return { ok: true, group, membership };
};

/**
 * Member OR community moderator may read chat / delete messages.
 */
export const ensureChatAccess = async (groupId, user) => {
  const [group, membership] = await Promise.all([
    WatchGroup.findOne({ _id: groupId, status: "active" })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean(),
    WatchGroupMember.findOne({
      watchGroup: groupId,
      user: user._id,
      status: "active",
    }).lean(),
  ]);

  if (!group) {
    return { ok: false, code: 404, message: "Watch group not found." };
  }

  const canModerate = await resolveCommunityModeration(group, user);
  if (!membership && !canModerate) {
    return {
      ok: false,
      code: 403,
      message: "Only watch group members can access chat.",
    };
  }

  return {
    ok: true,
    group,
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

export { WatchGroupMessage };
