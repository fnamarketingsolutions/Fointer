import Post from "../models/post.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import User from "../models/user.js";
import { escapeRegex } from "../utils/validate.js";
import { DISCOVERABLE_COMMUNITY_TYPES } from "../utils/communityPermissions.js";
import { sendServerError } from "../utils/safeError.js";

const DISCOVERABLE_CACHE_MS = 15_000;
let discoverableIdsCache = { ids: null, at: 0 };

const getDiscoverableCommunityIds = async () => {
  if (
    discoverableIdsCache.ids &&
    Date.now() - discoverableIdsCache.at < DISCOVERABLE_CACHE_MS
  ) {
    return discoverableIdsCache.ids;
  }
  const rows = await Community.find({
    type: { $in: DISCOVERABLE_COMMUNITY_TYPES },
  })
    .select("_id")
    .lean();
  const ids = rows.map((row) => row._id);
  discoverableIdsCache = { ids, at: Date.now() };
  return ids;
};

const getJoinedCommunityIds = async (userId) => {
  if (!userId) return [];
  const memberships = await CommunityMember.find({
    user: userId,
    status: "active",
  })
    .select("community")
    .lean();
  return memberships.map((row) => row.community);
};

const formatSearchPost = (post) => {
  const community = post.community;
  return {
    id: post._id,
    shortCode: post.shortCode || "",
    title: post.title || "",
    text: post.text || "",
    createdAt: post.createdAt,
    author: post.author
      ? {
          id: post.author._id,
          username: post.author.username,
          name: post.author.name,
          avatar: post.author.avatar || "",
        }
      : null,
    community:
      community && typeof community === "object" && community._id
        ? {
            id: community._id,
            shortCode: community.shortCode || "",
            name: community.name,
            coverImage: community.coverImage || "",
          }
        : null,
  };
};

const formatSearchCommunity = (community) => ({
  id: community._id,
  shortCode: community.shortCode || "",
  name: community.name,
  coverImage: community.coverImage || "",
  type: community.type,
  tags: community.tags || [],
});

const formatSearchProfile = (user) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  avatar: user.avatar || "",
  bio: user.bio || "",
});

const searchPosts = async (term, userId, limit) => {
  const [discoverableIds, joinedIds] = await Promise.all([
    getDiscoverableCommunityIds(),
    getJoinedCommunityIds(userId),
  ]);

  const scopeSet = new Set([
    ...discoverableIds.map(String),
    ...joinedIds.map(String),
  ]);

  const visibility = {
    community: { $in: [null, ...scopeSet] },
  };

  const filter = {
    $and: [
      visibility,
      {
        $or: [
          { title: { $regex: term, $options: "i" } },
          { text: { $regex: term, $options: "i" } },
        ],
      },
    ],
  };

  const posts = await Post.find(filter)
    .populate("author", "username name avatar")
    .populate("community", "name coverImage shortCode type")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return posts.map(formatSearchPost);
};

const searchCommunities = async (term, limit) => {
  const filter = {
    type: { $in: DISCOVERABLE_COMMUNITY_TYPES },
    $or: [{ name: { $regex: term, $options: "i" } }, { tags: term }],
  };

  const communities = await Community.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return communities.map(formatSearchCommunity);
};

const searchProfiles = async (term, limit, excludeUserId) => {
  const filter = {
    status: "active",
    $or: [
      { name: { $regex: term, $options: "i" } },
      { username: { $regex: term, $options: "i" } },
      { bio: { $regex: term, $options: "i" } },
    ],
  };

  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  const users = await User.find(filter)
    .select("username name avatar bio")
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  return users.map(formatSearchProfile);
};

const parseTypes = (raw) => {
  const allowed = new Set(["posts", "communities", "profiles"]);
  const list = String(raw || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => allowed.has(t));
  return list.length ? list : ["posts", "communities", "profiles"];
};

export const globalSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const minLength = 2;

    if (!q || q.length < minLength) {
      return res.status(400).json({
        success: false,
        message: `Enter at least ${minLength} characters to search.`,
      });
    }

    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit, 10) || 5),
      20
    );
    const types = parseTypes(req.query.types);
    const term = escapeRegex(q);
    const userId = req.user?._id || null;

    const results = {};

    await Promise.all(
      types.map(async (type) => {
        if (type === "posts") {
          results.posts = await searchPosts(term, userId, limit);
        } else if (type === "communities") {
          results.communities = await searchCommunities(term, limit);
        } else if (type === "profiles") {
          results.profiles = await searchProfiles(term, limit, userId);
        }
      })
    );

    return res.status(200).json({
      success: true,
      query: q,
      results,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
