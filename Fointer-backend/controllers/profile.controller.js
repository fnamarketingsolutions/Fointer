import bcrypt from "bcryptjs";
import User from "../models/user.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Post from "../models/post.js";
import { getEffectiveMemberRole } from "../utils/communityPermissions.js";
import { sendServerError } from "../utils/safeError.js";

const normalizeInterests = (interests) => {
  if (!interests) return [];
  const list = Array.isArray(interests)
    ? interests
    : String(interests)
        .split(",")
        .map((t) => t.trim());
  return [
    ...new Set(
      list
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
};

const formatProfileUser = (user) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: String(user.role || "user").toLowerCase().trim(),
  avatar: user.avatar || "",
  status: user.status || "active",
  bio: user.bio || "",
  interests: user.interests || [],
  hasPassword: Boolean(user.password),
  createdAt: user.createdAt,
});

const computeAchievements = ({ ownedCount, joinedCount, postCount, isMod }) => {
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

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const memberships = await CommunityMember.find({
      user: user._id,
      status: "active",
    });

    const communityIds = memberships.map((m) => m.community);
    const communities = await Community.find({ _id: { $in: communityIds } })
      .populate("owner", "username name")
      .sort({ createdAt: -1 })
      .lean();

    const roleMap = {};
    let isMod = false;
    let ownedCount = 0;
    for (const m of memberships) {
      const role = getEffectiveMemberRole(m);
      roleMap[String(m.community)] = role;
      if (role === "owner") ownedCount += 1;
      if (role === "moderator") isMod = true;
    }

    const posts = await Post.find({ author: user._id })
      .populate("community", "name")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const postCount = await Post.countDocuments({ author: user._id });

    const achievements = computeAchievements({
      ownedCount,
      joinedCount: memberships.length,
      postCount,
      isMod,
    });

    return res.status(200).json({
      success: true,
      profile: {
        ...formatProfileUser(user),
        communities: communities.map((c) => ({
          id: c._id,
          name: c.name,
          type: c.type,
          coverImage: c.coverImage || "",
          membershipRole: roleMap[String(c._id)] || "member",
        })),
        posts: posts.map((p) => ({
          id: p._id,
          title: p.title,
          text: p.text,
          createdAt: p.createdAt,
          community: p.community
            ? { id: p.community._id, name: p.community.name }
            : null,
        })),
        achievements,
        stats: {
          communitiesJoined: memberships.length,
          communitiesOwned: ownedCount,
          posts: postCount,
        },
      },
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }
      user.name = name;
    }

    if (req.body.username !== undefined) {
      const username = String(req.body.username || "")
        .trim()
        .replace(/^@+/, "")
        .trim();
      if (!username) {
        return res.status(400).json({
          success: false,
          message: "Username cannot be empty.",
        });
      }
      if (username !== user.username) {
        const usernameExists = await User.findOne({
          username,
          _id: { $ne: user._id },
        });
        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: "Username already exists.",
          });
        }
        user.username = username;
      }
    }

    if (req.body.bio !== undefined) {
      user.bio = String(req.body.bio || "").trim().slice(0, 500);
    }

    if (req.body.interests !== undefined) {
      user.interests = normalizeInterests(req.body.interests);
    }

    if (req.body.avatar !== undefined) {
      user.avatar = String(req.body.avatar || "").trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated.",
      user: formatProfileUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }
    return sendServerError(res, error);
  }
};

export const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account uses social login and does not have a password to change.",
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password, new password, and confirmation are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
