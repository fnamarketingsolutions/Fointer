import Community, { COMMUNITY_TYPES } from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";

const normalizeTags = (tags) => {
  if (!tags) return [];
  const list = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(",")
        .map((t) => t.trim());

  return [
    ...new Set(
      list
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
};

const formatOwner = (owner, ownerId) => {
  if (owner && typeof owner === "object" && owner._id) {
    return {
      id: owner._id,
      username: owner.username,
      name: owner.name,
      email: owner.email,
      avatar: owner.avatar || "",
    };
  }
  return { id: ownerId };
};

const formatCommunity = (community, extras = {}) => {
  const owner = community.owner;
  const ownerId =
    owner && typeof owner === "object" && owner._id
      ? owner._id
      : community.owner;

  return {
    id: community._id,
    name: community.name,
    description: community.description || "",
    rules: community.rules || "",
    tags: community.tags || [],
    coverImage: community.coverImage || "",
    type: community.type,
    owner: formatOwner(owner, ownerId),
    memberCount: extras.memberCount ?? community.memberCount ?? 0,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    ...extras,
  };
};

const formatJoinRequest = (request) => {
  const user = request.user;
  return {
    id: request._id,
    status: request.status,
    message: request.message || "",
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user:
      user && typeof user === "object" && user._id
        ? {
            id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
            avatar: user.avatar || "",
          }
        : { id: request.user },
  };
};

const canManageCommunity = (community, user) => {
  const ownerId =
    community.owner && community.owner._id
      ? community.owner._id
      : community.owner;
  return String(ownerId) === String(user._id) || user.role === "admin";
};

const getMemberCounts = async (communityIds) => {
  if (!communityIds.length) return {};

  const counts = await CommunityMember.aggregate([
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

  return counts.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});
};

const placeholderGrowthSeries = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  return months.map((label) => ({ label, value: 0 }));
};

export const createCommunity = async (req, res) => {
  try {
    const { name, description, rules, tags, coverImage, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Community name is required.",
      });
    }

    const communityType = type || "public";
    if (!COMMUNITY_TYPES.includes(communityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid community type. Allowed: ${COMMUNITY_TYPES.join(", ")}.`,
      });
    }

    const community = await Community.create({
      name: name.trim(),
      description: description?.trim() || "",
      rules: rules?.trim() || "",
      tags: normalizeTags(tags),
      coverImage: coverImage?.trim() || "",
      type: communityType,
      owner: req.user._id,
    });

    await CommunityMember.create({
      community: community._id,
      user: req.user._id,
      role: "owner",
      status: "active",
    });

    await community.populate("owner", "username name email avatar");

    return res.status(201).json({
      success: true,
      message: "Community created successfully.",
      community: formatCommunity(community, { memberCount: 1 }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listMyCommunities = async (req, res) => {
  try {
    const communities = await Community.find({ owner: req.user._id })
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const countMap = await getMemberCounts(communities.map((c) => c._id));

    return res.status(200).json({
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
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

export const listAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find()
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const countMap = await getMemberCounts(communities.map((c) => c._id));

    return res.status(200).json({
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
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

export const getCommunity = async (req, res) => {
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

    const countMap = await getMemberCounts([community._id]);

    return res.status(200).json({
      success: true,
      community: formatCommunity(community, {
        memberCount: countMap[String(community._id)] || 0,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    const { name, description, rules, tags, coverImage, type } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Community name cannot be empty.",
        });
      }
      community.name = name.trim();
    }
    if (description !== undefined) {
      community.description = description.trim();
    }
    if (rules !== undefined) {
      community.rules = rules.trim();
    }
    if (tags !== undefined) {
      community.tags = normalizeTags(tags);
    }
    if (coverImage !== undefined) {
      community.coverImage = coverImage.trim();
    }
    if (type !== undefined) {
      if (!COMMUNITY_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid community type. Allowed: ${COMMUNITY_TYPES.join(", ")}.`,
        });
      }
      community.type = type;
    }

    await community.save();
    await community.populate("owner", "username name email avatar");

    const countMap = await getMemberCounts([community._id]);

    return res.status(200).json({
      success: true,
      message: "Community updated successfully.",
      community: formatCommunity(community, {
        memberCount: countMap[String(community._id)] || 0,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    await CommunityMember.deleteMany({ community: community._id });
    await CommunityJoinRequest.deleteMany({ community: community._id });
    await Community.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Community deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCommunityManage = async (req, res) => {
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

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    const [memberCount, pendingRequests] = await Promise.all([
      CommunityMember.countDocuments({
        community: community._id,
        status: "active",
      }),
      CommunityJoinRequest.find({
        community: community._id,
        status: "pending",
      })
        .populate("user", "username name email avatar")
        .sort({ createdAt: -1 }),
    ]);

    return res.status(200).json({
      success: true,
      community: formatCommunity(community, { memberCount }),
      pendingRequests: pendingRequests.map(formatJoinRequest),
      metrics: {
        totalMembers: memberCount,
        engagementRate: 0,
        activeThreads: 0,
        tierLabel: "Elite",
        tierLevel: 1,
        growthSeries: placeholderGrowthSeries(),
        organicReach: 0,
        referralElite: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listJoinRequests = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    const status = req.query.status || "pending";
    const filter = { community: community._id };
    if (status !== "all") {
      filter.status = status;
    }

    const requests = await CommunityJoinRequest.find(filter)
      .populate("user", "username name email avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      requests: requests.map(formatJoinRequest),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const approveJoinRequest = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    const joinRequest = await CommunityJoinRequest.findOne({
      _id: req.params.requestId,
      community: community._id,
    }).populate("user", "username name email avatar");

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found.",
      });
    }

    if (joinRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending join requests can be approved.",
      });
    }

    joinRequest.status = "approved";
    await joinRequest.save();

    await CommunityMember.findOneAndUpdate(
      { community: community._id, user: joinRequest.user._id || joinRequest.user },
      {
        community: community._id,
        user: joinRequest.user._id || joinRequest.user,
        role: "member",
        status: "active",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Join request approved.",
      request: formatJoinRequest(joinRequest),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const denyJoinRequest = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you own.",
      });
    }

    const joinRequest = await CommunityJoinRequest.findOne({
      _id: req.params.requestId,
      community: community._id,
    }).populate("user", "username name email avatar");

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found.",
      });
    }

    if (joinRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending join requests can be denied.",
      });
    }

    joinRequest.status = "denied";
    await joinRequest.save();

    return res.status(200).json({
      success: true,
      message: "Join request denied.",
      request: formatJoinRequest(joinRequest),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
