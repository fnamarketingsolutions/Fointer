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

export const formatFollowUser = (user) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  avatar: user.avatar || "",
  bio: user.bio || "",
});
