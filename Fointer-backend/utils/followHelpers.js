import Follow from "../models/follow.js";
export const getFollowedUserIds = async (userId) => {
  if (!userId) return [];
  const rows = await Follow.find({ follower: userId })
    .select("following")
    .lean();
  return rows.map((row) => row.following);
};

export const getFollowCounts = async (userId) => {
  if (!userId) {
    return { followers: 0, following: 0 };
  }
  const [followers, following] = await Promise.all([
    Follow.countDocuments({ following: userId }),
    Follow.countDocuments({ follower: userId }),
  ]);
  return { followers, following };
};

export const isFollowing = async (followerId, followingId) => {
  if (!followerId || !followingId) return false;
  const row = await Follow.findOne({
    follower: followerId,
    following: followingId,
  })
    .select("_id")
    .lean();
  return Boolean(row);
}; 

/** Returns Sets of string ids for viewer↔listed-user follow edges. */
export const getViewerFollowFlags = async (viewerId, userIds) => {
  const ids = (userIds || []).filter(Boolean);
  if (!viewerId || !ids.length) {
    return { followingIds: new Set(), followedByIds: new Set() };
  }

  const [followingRows, followedByRows] = await Promise.all([
    Follow.find({
      follower: viewerId,
      following: { $in: ids },
    })
      .select("following")
      .lean(),
    Follow.find({
      follower: { $in: ids },
      following: viewerId,
    })
      .select("follower")
      .lean(),
  ]);

  return {
    followingIds: new Set(followingRows.map((row) => String(row.following))),
    followedByIds: new Set(followedByRows.map((row) => String(row.follower))),
  };
};

export const formatFollowUser = (user, flags = {}) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  avatar: user.avatar || "",
  bio: user.bio || "",
  isFollowing: Boolean(flags.isFollowing),
  isFollowedBy: Boolean(flags.isFollowedBy),
});