import bcrypt from "bcryptjs";
import User from "../models/user.js";
import ActivityLog from "../models/activityLog.js";
import CommunityMember from "../models/communityMember.js";
import Community from "../models/community.js";
import { logActivity } from "../utils/logActivity.js";

export const getOverview = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: `Welcome back, ${req.user.name}.`,
      stats: {
        role: req.user.role,
        accountStatus: req.user.status || "active",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const formatAdminUser = (u) => ({
  id: u._id,
  username: u.username,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status || "active",
  avatar: u.avatar || "",
  googleId: u.googleId || null,
  facebookId: u.facebookId || null,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const formatCommunity = (community, memberCount = 0) => ({
  id: community._id,
  name: community.name,
  description: community.description || "",
  rules: community.rules || "",
  tags: community.tags || [],
  coverImage: community.coverImage || "",
  galleryImages: community.galleryImages || [],
  type: community.type,
  owner: community.owner
    ? {
        id: community.owner._id || community.owner,
        username: community.owner.username,
        name: community.owner.name,
        email: community.owner.email,
        avatar: community.owner.avatar || "",
      }
    : null,
  memberCount,
  createdAt: community.createdAt,
  updatedAt: community.updatedAt,
});

const formatCommunityMember = (member) => ({
  id: member._id,
  role: member.role,
  moderatorExpiresAt: member.moderatorExpiresAt || null,
  createdAt: member.createdAt,
  user: member.user
    ? {
        id: member.user._id,
        username: member.user.username,
        name: member.user.name,
        email: member.user.email,
        avatar: member.user.avatar || "",
      }
    : { id: member.user },
});

const getMemberCountMap = async (communityIds = []) => {
  if (!communityIds.length) return {};
  const rows = await CommunityMember.aggregate([
    {
      $match: {
        community: { $in: communityIds },
        status: "active",
      },
    },
    {
      $group: {
        _id: "$community",
        count: { $sum: 1 },
      },
    },
  ]);
  return rows.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});
};

export const listUsers = async (req, res) => {
  try {
    const { status, role, moderators, q } = req.query;
    const filter = {};

    if (status && ["active", "suspended", "banned"].includes(String(status))) {
      filter.status = status;
    }

    if (role && ["admin", "user"].includes(String(role))) {
      filter.role = role;
    }

    if (moderators === "true") {
      const modMemberships = await CommunityMember.find({
        status: "active",
        role: "moderator",
      }).select("user moderatorExpiresAt");

      const now = new Date();
      const modUserIds = [
        ...new Set(
          modMemberships
            .filter(
              (m) =>
                !m.moderatorExpiresAt || new Date(m.moderatorExpiresAt) > now
            )
            .map((m) => String(m.user))
        ),
      ];

      filter._id = { $in: modUserIds };
    }

    if (q && String(q).trim()) {
      const term = String(q).trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { username: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select(
        "username name email role status avatar googleId facebookId createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users: users.map(formatAdminUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, role, status } = req.body;

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isSelf = String(target._id) === String(req.user._id);

    if (role !== undefined) {
      const nextRole = String(role).toLowerCase().trim();
      if (!["admin", "user"].includes(nextRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Allowed: admin, user.",
        });
      }

      if (isSelf && nextRole !== target.role) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own role.",
        });
      }

      if (target.role === "admin" && nextRole !== "admin") {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: "Cannot demote the last admin.",
          });
        }
      }

      target.role = nextRole;
    }

    if (status !== undefined) {
      if (!["active", "suspended", "banned"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Allowed: active, suspended, banned.",
        });
      }
      if (isSelf && status !== "active") {
        return res.status(400).json({
          success: false,
          message: "You cannot suspend or ban your own account.",
        });
      }
      target.status = status;
    }

    if (name !== undefined) target.name = name.trim();
    if (username !== undefined) target.username = username.trim();
    if (email !== undefined) target.email = email.trim().toLowerCase();

    await target.save();

    await logActivity({
      actor: req.user._id,
      action: "admin.user.update",
      targetType: "user",
      targetId: target._id,
      meta: { name, username, email, role, status },
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: formatAdminUser(target.toObject()),
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(400).json({
        success: false,
        message: `${field} already in use.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    target.password = await bcrypt.hash(String(password), 10);
    await target.save();

    await logActivity({
      actor: req.user._id,
      action: "admin.user.reset_password",
      targetType: "user",
      targetId: target._id,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await ActivityLog.find({ actor: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        meta: l.meta,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAdminUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select(
        "username name email role status avatar googleId facebookId createdAt updatedAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const communities = await Community.find({ owner: user._id })
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const countMap = await getMemberCountMap(communities.map((c) => c._id));
    const communityMembers = await CommunityMember.find({
      community: { $in: communities.map((c) => c._id) },
      status: "active",
    })
      .populate("user", "username name email avatar")
      .sort({ role: 1, createdAt: -1 })
      .lean();

    const membersByCommunity = communityMembers.reduce((acc, member) => {
      const communityId = String(member.community);
      if (!acc[communityId]) acc[communityId] = [];
      acc[communityId].push(formatCommunityMember(member));
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      user: formatAdminUser(user),
      communityCount: communities.length,
      ownedCommunities: communities.map((community) =>
        ({
          ...formatCommunity(community, countMap[String(community._id)] || 0),
          members: membersByCommunity[String(community._id)] || [],
        })
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAdminCommunityDetail = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).populate(
      "owner",
      "username name email avatar"
    );

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    const memberCountMap = await getMemberCountMap([community._id]);
    const members = await CommunityMember.find({
      community: community._id,
      status: "active",
    })
      .populate("user", "username name email avatar")
      .sort({ role: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      community: formatCommunity(
        community,
        memberCountMap[String(community._id)] || 0
      ),
      members: members.map(formatCommunityMember),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (target.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last admin.",
        });
      }
    }

    await User.findByIdAndDelete(id);

    await logActivity({
      actor: req.user._id,
      action: "admin.user.delete",
      targetType: "user",
      targetId: id,
      meta: { email: target.email },
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
