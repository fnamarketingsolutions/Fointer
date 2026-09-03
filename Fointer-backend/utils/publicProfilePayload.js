import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Post from "../models/post.js";
import Reshare from "../models/reshare.js";
import { getEffectiveMemberRole } from "./communityPermissions.js";
import {
  getFollowCounts,
  isFollowing,
} from "./followHelpers.js";

const DISCOVERABLE_TYPES = ["public", "private_request"];
const LIST_LIMIT = 20;

export const computeAchievements = ({
  ownedCount,
  joinedCount,
  postCount,
  isMod,
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
  return badges;
};

const getJoinedCommunityIds = async (userId) => {
  if (!userId) return [];
  const rows = await CommunityMember.find({
    user: userId,
    status: "active",
  })
    .select("community")
    .lean();
  return rows.map((row) => row.community);
};

const getVisiblePostCommunityIds = async (viewerId) => {
  const discoverable = await Community.find({
    type: { $in: DISCOVERABLE_TYPES },
  })
    .select("_id")
    .lean();
  const scope = new Set(discoverable.map((row) => String(row._id)));

  if (viewerId) {
    const joined = await getJoinedCommunityIds(viewerId);
    for (const id of joined) scope.add(String(id));
  }

  return [...scope];
};

const postVisibilityFilter = (scopeIds) => ({
  $or: [{ community: null }, { community: { $in: scopeIds } }],
});

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

export const buildPublicProfilePayload = async (user, viewer = null) => {
  const viewerId = viewer?._id || null;
  const scopeIds = await getVisiblePostCommunityIds(viewerId);
  const visibility = postVisibilityFilter(scopeIds);

  const memberships = await CommunityMember.find({
    user: user._id,
    status: "active",
  }).lean();

  const memberCommunityIds = memberships.map((row) => row.community);
  const viewerJoinedSet = new Set(
    viewerId
      ? (await getJoinedCommunityIds(viewerId)).map(String)
      : []
  );

  const communityFilter = {
    _id: { $in: memberCommunityIds },
    $or: [{ type: { $in: DISCOVERABLE_TYPES } }],
  };
  if (viewerId && viewerJoinedSet.size) {
    communityFilter.$or.push({
      _id: {
        $in: memberCommunityIds.filter((id) =>
          viewerJoinedSet.has(String(id))
        ),
      },
    });
  }

  const communities = await Community.find(communityFilter)
    .sort({ createdAt: -1 })
    .lean();

  const roleMap = {};
  let isMod = false;
  let ownedCount = 0;
  for (const membership of memberships) {
    const role = getEffectiveMemberRole(membership);
    roleMap[String(membership.community)] = role;
    if (role === "owner") ownedCount += 1;
    if (role === "moderator") isMod = true;
  }

  const visibleCommunityIds = new Set(communities.map((c) => String(c._id)));

  const [posts, postCount, reshares] = await Promise.all([
    Post.find({ author: user._id, ...visibility })
      .populate("community", "name shortCode coverImage")
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    Post.countDocuments({ author: user._id, ...visibility }),
    Reshare.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
  ]);

  const resharePostIds = reshares.map((row) => row.post);
  let reposts = [];
  if (resharePostIds.length) {
    const repostPosts = await Post.find({
      _id: { $in: resharePostIds },
      ...visibility,
    })
      .populate("author", "username name avatar")
      .populate("community", "name shortCode coverImage")
      .lean();

    const postMap = Object.fromEntries(
      repostPosts.map((post) => [String(post._id), post])
    );
    const resharedAtMap = Object.fromEntries(
      reshares.map((row) => [String(row.post), row.createdAt])
    );

    reposts = resharePostIds
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
  }

  const repostCount = await Reshare.countDocuments({ user: user._id });

  const achievements = computeAchievements({
    ownedCount,
    joinedCount: memberships.length,
    postCount,
    isMod,
  });

  const [followCounts, viewerFollowing] = await Promise.all([
    getFollowCounts(user._id),
    viewerId ? isFollowing(viewerId, user._id) : Promise.resolve(false),
  ]);

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
    createdAt: user.createdAt,
    isFollowing: viewerFollowing,
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
    },
  };
};
