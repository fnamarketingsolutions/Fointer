import CommunityMember from "../models/communityMember.js";
import SystemSetting from "../models/systemSetting.js";

const DEFAULT_EDIT_WINDOW_MINUTES = 60;
const CACHE_MS = 30_000;

let cachedMinutes = null;
let cacheAt = 0;

export const invalidateEditWindowCache = () => {
  cachedMinutes = null;
  cacheAt = 0;
};

export const getEditWindowMinutes = async () => {
  if (cachedMinutes != null && Date.now() - cacheAt < CACHE_MS) {
    return cachedMinutes;
  }

  try {
    const setting = await SystemSetting.findOne({ key: "global" })
      .select("postEditWindowMinutes")
      .lean();
    if (
      setting?.postEditWindowMinutes != null &&
      Number.isFinite(Number(setting.postEditWindowMinutes))
    ) {
      cachedMinutes = Math.max(1, Number(setting.postEditWindowMinutes));
    } else {
      cachedMinutes =
        Number(process.env.POST_EDIT_WINDOW_MINUTES) ||
        DEFAULT_EDIT_WINDOW_MINUTES;
    }
  } catch {
    cachedMinutes =
      Number(process.env.POST_EDIT_WINDOW_MINUTES) ||
      DEFAULT_EDIT_WINDOW_MINUTES;
  }

  cacheAt = Date.now();
  return cachedMinutes;
};

export const getEditWindowMs = async () => {
  const minutes = await getEditWindowMinutes();
  return minutes * 60 * 1000;
};

export const isWithinEditWindow = async (createdAt) => {
  if (!createdAt) return false;
  const windowMs = await getEditWindowMs();
  return Date.now() - new Date(createdAt).getTime() < windowMs;
};

export const getEffectiveMemberRole = (membership) => {
  if (!membership || membership.status !== "active") return null;
  if (
    membership.role === "moderator" &&
    membership.moderatorExpiresAt &&
    new Date(membership.moderatorExpiresAt) < new Date()
  ) {
    return "member";
  }
  return membership.role;
};

export const getMembership = async (communityId, userId) => {
  return CommunityMember.findOne({
    community: communityId,
    user: userId,
    status: "active",
  });
};

export const getBannedMembership = async (communityId, userId) => {
  return CommunityMember.findOne({
    community: communityId,
    user: userId,
    status: "banned",
  });
};

export const canManageCommunity = (community, user) => {
  const ownerId =
    community.owner && community.owner._id
      ? community.owner._id
      : community.owner;
  return String(ownerId) === String(user._id) || user.role === "admin";
};

export const DISCOVERABLE_COMMUNITY_TYPES = ["public", "private_request"];

export const isDiscoverableCommunityType = (type) =>
  DISCOVERABLE_COMMUNITY_TYPES.includes(String(type || ""));

export const canViewCommunity = (community, user, membership) => {
  if (user?.role === "admin") return true;
  if (getEffectiveMemberRole(membership)) return true;
  return isDiscoverableCommunityType(community?.type);
};

export const getActorCommunityRole = async (communityId, user) => {
  if (user.role === "admin") return "admin";
  const membership = await getMembership(communityId, user._id);
  return getEffectiveMemberRole(membership);
};

export const canModerateCommunity = async (community, user) => {
  const role = await getActorCommunityRole(community._id, user);
  return role === "admin" || role === "owner" || role === "moderator";
};

export const formatMember = (membership) => {
  const user = membership.user;
  const expired =
    membership.role === "moderator" &&
    membership.moderatorExpiresAt &&
    new Date(membership.moderatorExpiresAt) < new Date();

  return {
    id: membership._id,
    role: expired ? "member" : membership.role,
    storedRole: membership.role,
    moderatorExpiresAt: membership.moderatorExpiresAt || null,
    status: membership.status,
    bannedAt: membership.bannedAt || null,
    createdAt: membership.createdAt,
    user:
      user && typeof user === "object" && user._id
        ? {
            id: user._id,
            username: user.username,
            name: user.name,
            avatar: user.avatar || "",
          }
        : { id: membership.user },
  };
};

export const canEngageInCommunity = async (communityId, user) => {
  if (user.role === "admin") return true;
  const membership = await getMembership(communityId, user._id);
  return Boolean(getEffectiveMemberRole(membership));
};

export const canManagePostsInCommunity = async (communityId, user) => {
  if (user.role === "admin") return true;
  const membership = await getMembership(communityId, user._id);
  const role = getEffectiveMemberRole(membership);
  return role === "owner" || role === "moderator";
};
