import Post from "../models/post.js";
import User from "../models/user.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";
import Reaction from "../models/reaction.js";
import Reshare from "../models/reshare.js";
import Bookmark from "../models/bookmark.js";
import {
  getEditWindowMinutes,
  getEffectiveMemberRole,
} from "./communityPermissions.js";

const REFRESH_MS = 8_000;
const POST_LIMIT = 40;
const COMMUNITY_LIMIT = 24;

let snapshot = null;
let refreshing = null;
let timer = null;

const toId = (value) => (value == null ? "" : String(value));

const addToSetMap = (map, key, userId) => {
  const id = toId(key);
  if (!id) return;
  let bucket = map.get(id);
  if (!bucket) {
    bucket = new Set();
    map.set(id, bucket);
  }
  bucket.add(toId(userId));
};

const loadPosts = async () => {
  const found = await Post.aggregate([
    { $match: { openFeed: true, isArchived: false } },
    { $sort: { createdAt: -1 } },
    { $limit: POST_LIMIT + 1 },
    {
      $lookup: {
        from: User.collection.name,
        localField: "author",
        foreignField: "_id",
        pipeline: [{ $project: { username: 1, name: 1, avatar: 1, role: 1 } }],
        as: "author",
      },
    },
    {
      $lookup: {
        from: Community.collection.name,
        localField: "community",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              name: 1,
              coverImage: 1,
              shortCode: 1,
              type: 1,
              channel: 1,
            },
          },
        ],
        as: "community",
      },
    },
    {
      $set: {
        author: { $ifNull: [{ $arrayElemAt: ["$author", 0] }, null] },
        community: { $ifNull: [{ $arrayElemAt: ["$community", 0] }, null] },
      },
    },
  ]);

  const hasMore = found.length > POST_LIMIT;
  return { posts: hasMore ? found.slice(0, POST_LIMIT) : found, hasMore };
};

const loadCommunities = async () => {
  const [communities, communityTotal] = await Promise.all([
    Community.find({ type: { $in: ["public", "private_request"] } })
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(COMMUNITY_LIMIT)
      .populate({ path: "owner", select: "username name email avatar" })
      .lean(),
    Community.countDocuments({ type: { $in: ["public", "private_request"] } }),
  ]);
  return { communities, communityTotal };
};

const loadViewerMaps = async (postIds) => {
  const [likes, reshares, saves, memberships, pending] = await Promise.all([
    Reaction.find({ targetType: "post", targetId: { $in: postIds } })
      .select("targetId user")
      .lean(),
    Reshare.find({ post: { $in: postIds } }).select("post user").lean(),
    Bookmark.find({ targetType: "post", targetId: { $in: postIds } })
      .select("targetId user")
      .lean(),
    CommunityMember.find({ status: "active" })
      .select("user community role status moderatorExpiresAt")
      .lean(),
    CommunityJoinRequest.find({ status: "pending" })
      .select("user community")
      .lean(),
  ]);

  const likedBy = new Map();
  const resharedBy = new Map();
  const savedBy = new Map();
  for (const row of likes) addToSetMap(likedBy, row.targetId, row.user);
  for (const row of reshares) addToSetMap(resharedBy, row.post, row.user);
  for (const row of saves) addToSetMap(savedBy, row.targetId, row.user);

  const accessByUser = new Map();
  for (const row of memberships) {
    const userId = toId(row.user);
    if (!userId) continue;
    let access = accessByUser.get(userId);
    if (!access) {
      access = { joinedIdSet: new Set(), manageableIdSet: new Set() };
      accessByUser.set(userId, access);
    }
    const communityId = toId(row.community);
    access.joinedIdSet.add(communityId);
    const role = getEffectiveMemberRole(row);
    if (role === "owner" || role === "moderator") {
      access.manageableIdSet.add(communityId);
    }
  }

  const pendingByUser = new Map();
  for (const row of pending) addToSetMap(pendingByUser, row.user, row.community);

  return { likedBy, resharedBy, savedBy, accessByUser, pendingByUser };
};

const refreshOnce = async () => {
  const [{ posts, hasMore }, communitySnap] = await Promise.all([
    loadPosts(),
    loadCommunities(),
    getEditWindowMinutes(),
  ]);
  const viewerMaps = await loadViewerMaps(posts.map((post) => post._id));
  snapshot = {
    posts,
    hasMore,
    ...communitySnap,
    ...viewerMaps,
    at: Date.now(),
  };
};

export const getHotSnapshot = () => snapshot;

export const refreshHotReads = () => {
  if (refreshing) return refreshing;
  refreshing = refreshOnce()
    .catch((error) => {
      console.error("Hot read cache refresh failed:", error?.message || error);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

export const startHotReadCache = () => {
  if (timer) return refreshHotReads();
  timer = setInterval(() => {
    refreshHotReads();
  }, REFRESH_MS);
  timer.unref?.();
  return refreshHotReads();
};
