import mongoose from "mongoose";
import User from "../models/user.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Post from "../models/post.js";
import Reshare from "../models/reshare.js";
import { getEffectiveMemberRole } from "./communityPermissions.js";
import {
  getFollowCounts,
  isFollowing,
} from "./followHelpers.js";
import { countQualifiedReferrals } from "../services/referral.service.js";
import { getHotSnapshot } from "./hotReadCache.js";

const DISCOVERABLE_TYPES = ["public"];
const LIST_LIMIT = 20;

export const computeAchievements = ({
  ownedCount,
  joinedCount,
  postCount,
  isMod,
  qualifiedReferrals = 0,
}) => {
  const badges = [];
  if (ownedCount > 0) {
    badges.push({
      id: "community_owner",
      label: "Community Owner",
      description: "Created or owns at least one community",
    });
  }
  if (joinedCount > 0) {
    badges.push({
      id: "active_member",
      label: "Active Member",
      description: "Joined at least one community",
    });
  }
  if (postCount > 0) {
    badges.push({
      id: "contributor",
      label: "Contributor",
      description: "Published at least one post",
    });
  }
  if (isMod) {
    badges.push({
      id: "moderator",
      label: "Moderator",
      description: "Serves as a community moderator",
    });
  }
  if (postCount >= 5) {
    badges.push({
      id: "elite_voice",
      label: "Elite Voice",
      description: "Shared 5 or more posts",
    });
  }
  if (qualifiedReferrals >= 1) {
    badges.push({
      id: "inviter",
      label: "Inviter",
      description: "Invited a friend who joined Fointer",
    });
  }
  if (qualifiedReferrals >= 5) {
    badges.push({
      id: "community_builder",
      label: "Community Builder",
      description: "Invited 5 or more friends who joined",
    });
  }
  return badges;
};

const asObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));

const postVisibilityFilter = (scopeIds) => ({
  $or: [
    { community: null },
    { community: { $in: scopeIds.map(asObjectId) } },
  ],
});

const scopeFromCache = (hot, viewerId) => {
  const scope = new Set();
  for (const community of hot.allCommunities) {
    if (DISCOVERABLE_TYPES.includes(community.type)) {
      scope.add(String(community._id));
    }
  }
  if (viewerId) {
    const joined = hot.accessByUser.get(String(viewerId))?.joinedIdSet;
    if (joined) {
      for (const id of joined) scope.add(String(id));
    }
  }
  return [...scope];
};

const viewerJoinedFromCache = (hot, viewerId) =>
  viewerId
    ? new Set(hot.accessByUser.get(String(viewerId))?.joinedIdSet || [])
    : new Set();

const membershipFromCache = (hot, userId) => {
  const access = hot.accessByUser.get(String(userId));
  const roleMap = {};
  let ownedCount = 0;
  let isMod = false;
  const memberCommunityIds = [];
  if (access) {
    for (const [communityId, role] of access.roleByCommunity) {
      roleMap[communityId] = role;
      memberCommunityIds.push(communityId);
      if (role === "owner") ownedCount += 1;
      if (role === "moderator") isMod = true;
    }
  }
  return {
    roleMap,
    ownedCount,
    isMod,
    memberCommunityIds,
    joinedCount: access?.joinedIdSet?.size || 0,
  };
};

const loadScopeIds = async (viewerId) => {
  const [discoverable, joined] = await Promise.all([
    Community.find({ type: { $in: DISCOVERABLE_TYPES } }).select("_id").lean(),
    viewerId
      ? CommunityMember.find({ user: viewerId, status: "active" })
          .select("community")
          .lean()
      : Promise.resolve([]),
  ]);
  const scope = new Set(discoverable.map((row) => String(row._id)));
  const viewerJoined = new Set();
  for (const row of joined) {
    const id = String(row.community);
    scope.add(id);
    viewerJoined.add(id);
  }
  return { scopeIds: [...scope], viewerJoined };
};

const loadMembershipBundle = async (userId) => {
  const memberships = await CommunityMember.find({
    user: userId,
    status: "active",
  }).lean();
  const roleMap = {};
  let ownedCount = 0;
  let isMod = false;
  for (const membership of memberships) {
    const role = getEffectiveMemberRole(membership);
    roleMap[String(membership.community)] = role;
    if (role === "owner") ownedCount += 1;
    if (role === "moderator") isMod = true;
  }
  return {
    roleMap,
    ownedCount,
    isMod,
    memberCommunityIds: memberships.map((row) => row.community),
    joinedCount: memberships.length,
  };
};

const loadVisibleCommunities = (memberCommunityIds, viewerJoined, viewerId) => {
  if (!memberCommunityIds.length) return Promise.resolve([]);
  const filter = {
    _id: { $in: memberCommunityIds },
    $or: [{ type: { $in: DISCOVERABLE_TYPES } }],
  };
  if (viewerId && viewerJoined.size) {
    filter.$or.push({
      _id: {
        $in: memberCommunityIds.filter((id) => viewerJoined.has(String(id))),
      },
    });
  }
  return Community.find(filter).sort({ createdAt: -1 }).lean();
};

const communitiesFromCache = (hot, memberCommunityIds, viewerJoined, viewerId) => {
  const byId = new Map(
    hot.allCommunities.map((community) => [String(community._id), community])
  );
  const rows = [];
  for (const id of memberCommunityIds) {
    const community = byId.get(String(id));
    if (!community) continue;
    const isPublic = DISCOVERABLE_TYPES.includes(community.type);
    const viewerShares = Boolean(viewerId) && viewerJoined.has(String(id));
    if (isPublic || viewerShares) rows.push(community);
  }
  rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return rows;
};

const loadVisiblePosts = (userId, scopeIds) =>
  Post.aggregate([
    {
      $match: {
        author: asObjectId(userId),
        isArchived: { $ne: true },
        ...postVisibilityFilter(scopeIds),
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: LIST_LIMIT },
    {
      $lookup: {
        from: Community.collection.name,
        localField: "community",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, shortCode: 1, coverImage: 1 } }],
        as: "community",
      },
    },
    {
      $set: {
        community: { $ifNull: [{ $arrayElemAt: ["$community", 0] }, null] },
      },
    },
  ]);

const countVisiblePosts = (userId, scopeIds) =>
  Post.countDocuments({
    author: userId,
    isArchived: { $ne: true },
    ...postVisibilityFilter(scopeIds),
  });

const loadRepostPosts = (postIds, scopeIds) =>
  Post.aggregate([
    {
      $match: {
        _id: { $in: postIds.map(asObjectId) },
        isArchived: { $ne: true },
        ...postVisibilityFilter(scopeIds),
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: "author",
        foreignField: "_id",
        pipeline: [{ $project: { username: 1, name: 1, avatar: 1 } }],
        as: "author",
      },
    },
    {
      $lookup: {
        from: Community.collection.name,
        localField: "community",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, shortCode: 1, coverImage: 1 } }],
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

const mapPostRow = (post) => ({
  id: post._id,
  title: post.title,
  text: post.text,
  shortCode: post.shortCode || "",
  createdAt: post.createdAt,
  community: post.community
    ? {
        id: post.community._id,
        name: post.community.name,
        shortCode: post.community.shortCode || "",
        coverImage: post.community.coverImage || "",
      }
    : null,
});

const mapReposts = (resharePostIds, repostPosts, reshares) => {
  const postMap = Object.fromEntries(
    repostPosts.map((post) => [String(post._id), post])
  );
  const resharedAtMap = Object.fromEntries(
    reshares.map((row) => [String(row.post), row.createdAt])
  );
  return resharePostIds
    .map((id) => {
      const post = postMap[String(id)];
      if (!post) return null;
      return {
        ...mapPostRow(post),
        originalAuthor: post.author
          ? {
              id: post.author._id,
              username: post.author.username,
              name: post.author.name,
              avatar: post.author.avatar || "",
            }
          : null,
        resharedAt: resharedAtMap[String(id)] || null,
      };
    })
    .filter(Boolean);
};

export const buildPublicProfilePayload = async (user, viewer = null) => {
  const viewerId = viewer?._id || null;
  const hot = getHotSnapshot();
  const cacheReady =
    Array.isArray(hot?.allCommunities) && hot?.accessByUser instanceof Map;
  const cachedScope = cacheReady
    ? {
        scopeIds: scopeFromCache(hot, viewerId),
        viewerJoined: viewerJoinedFromCache(hot, viewerId),
      }
    : null;
  const cachedMembership = cacheReady
    ? membershipFromCache(hot, user._id)
    : null;

  const [
    loadedScope,
    loadedMembership,
    cachedPosts,
    cachedPostCount,
    followCounts,
    viewerFollowing,
    viewerFollowedBy,
    qualifiedReferrals,
    reshares,
    repostCount,
  ] = await Promise.all([
    cachedScope ? Promise.resolve(null) : loadScopeIds(viewerId),
    cachedMembership ? Promise.resolve(null) : loadMembershipBundle(user._id),
    cachedScope
      ? loadVisiblePosts(user._id, cachedScope.scopeIds)
      : Promise.resolve(null),
    cachedScope
      ? countVisiblePosts(user._id, cachedScope.scopeIds)
      : Promise.resolve(null),
    getFollowCounts(user._id),
    viewerId ? isFollowing(viewerId, user._id) : Promise.resolve(false),
    viewerId ? isFollowing(user._id, viewerId) : Promise.resolve(false),
    countQualifiedReferrals(user._id),
    Reshare.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .select("post createdAt")
      .lean(),
    Reshare.countDocuments({ user: user._id }),
  ]);

  const scopeBundle = cachedScope || loadedScope;
  const membership = cachedMembership || loadedMembership;
  const resharePostIds = reshares.map((row) => row.post);
  const [posts, postCount, communities, repostPosts] = await Promise.all([
    cachedScope
      ? Promise.resolve(cachedPosts)
      : loadVisiblePosts(user._id, scopeBundle.scopeIds),
    cachedScope
      ? Promise.resolve(cachedPostCount)
      : countVisiblePosts(user._id, scopeBundle.scopeIds),
    cacheReady
      ? Promise.resolve(
          communitiesFromCache(
            hot,
            membership.memberCommunityIds,
            scopeBundle.viewerJoined,
            viewerId
          )
        )
      : loadVisibleCommunities(
          membership.memberCommunityIds,
          scopeBundle.viewerJoined,
          viewerId
        ),
    resharePostIds.length
      ? loadRepostPosts(resharePostIds, scopeBundle.scopeIds)
      : Promise.resolve([]),
  ]);

  const visibleCommunityIds = new Set(communities.map((c) => String(c._id)));
  const reposts = mapReposts(resharePostIds, repostPosts, reshares);
  const { ownedCount, isMod, joinedCount, roleMap } = membership;

  const achievements = computeAchievements({
    ownedCount,
    joinedCount,
    postCount,
    isMod,
    qualifiedReferrals,
  });

  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
    bio: user.bio || "",
    interests: user.interests || [],
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
    ageRange: user.ageRange || "",
    createdAt: user.createdAt,
    isFollowing: viewerFollowing,
    isFollowedBy: viewerFollowedBy,
    hideFollowersList: Boolean(user.hideFollowersList),
    hideFollowingList: Boolean(user.hideFollowingList),
    communities: communities.map((community) => ({
      id: community._id,
      name: community.name,
      type: community.type,
      shortCode: community.shortCode || "",
      coverImage: community.coverImage || "",
      membershipRole: roleMap[String(community._id)] || "member",
    })),
    posts: posts.map(mapPostRow),
    reposts,
    achievements,
    stats: {
      communitiesJoined: visibleCommunityIds.size || communities.length,
      communitiesOwned: ownedCount,
      posts: postCount,
      reposts: repostCount,
      followers: followCounts.followers,
      following: followCounts.following,
      referrals: qualifiedReferrals,
    },
  };
};
