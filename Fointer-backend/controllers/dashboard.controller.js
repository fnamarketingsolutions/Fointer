import User from "../models/user.js";
import CommunityMember from "../models/communityMember.js";
import Community from "../models/community.js";
// import { logActivity } from "../utils/logActivity.js";

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

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: active, banned.",
      });
    }

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isSelf = String(target._id) === String(req.user._id);

    if (isSelf && status === "banned") {
      return res.status(400).json({
        success: false,
        message: "You cannot ban your own account.",
      });
    }

    target.status = status;
    await target.save();

    // await logActivity({
    //   actor: req.user._id,
    //   action: "admin.user.status",
    //   targetType: "user",
    //   targetId: target._id,
    //   meta: { status },
    // });

    return res.status(200).json({
      success: true,
      message: "User status updated successfully.",
      user: formatAdminUser(target.toObject()),
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
