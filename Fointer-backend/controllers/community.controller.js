import Community, { COMMUNITY_TYPES } from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";
import CommunityInvite from "../models/communityInvite.js";
import User from "../models/user.js";
import { destroyManyFromCloudinary } from "../utils/cloudinary.js";
import {
  getMembership,
  getEffectiveMemberRole,
  getBannedMembership,
  canManageCommunity,
  canModerateCommunity,
  getActorCommunityRole,
  formatMember,
} from "../utils/communityPermissions.js";
import {
  parsePagination,
  resolveSort,
  buildPaginationMeta,
} from "../utils/pagination.js";
import {
  getRequestsActionUrl,
  sendJoinRequestReceivedEmail,
  sendCommunityInviteEmail,
  sendCommunityInviteAcceptedEmail,
  sendCommunityInviteDeclinedEmail,
} from "../utils/sendVerificationEmail.js";

const COMMUNITY_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

const MAX_GALLERY_IMAGES = 5;

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

const normalizeGalleryImages = (images) => {
  if (!images) return [];
  const list = Array.isArray(images) ? images : [images];
  return [
    ...new Set(
      list
        .map((url) => String(url || "").trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_GALLERY_IMAGES);
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
    galleryImages: community.galleryImages || [],
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

const canInviteToCommunity = async (community, user) => {
  if (canManageCommunity(community, user)) return true;
  const membership = await getMembership(community._id, user._id);
  const role = getEffectiveMemberRole(membership);
  return role === "owner" || role === "moderator";
};

const formatInviteUser = (user, fallbackId) => {
  if (user && typeof user === "object" && user._id) {
    return {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
    };
  }
  return { id: fallbackId };
};

const formatInvite = (invite) => {
  const community = invite.community;
  return {
    id: invite._id,
    status: invite.status,
    message: invite.message || "",
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    inviter: formatInviteUser(invite.inviter, invite.inviter),
    invitee: formatInviteUser(invite.invitee, invite.invitee),
    community:
      community && typeof community === "object" && community._id
        ? formatCommunity(community)
        : { id: invite.community },
  };
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
    const { name, description, rules, tags, coverImage, galleryImages, type } =
      req.body;

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

    const gallery = normalizeGalleryImages(galleryImages);
    if (Array.isArray(galleryImages) && galleryImages.length > MAX_GALLERY_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_GALLERY_IMAGES} gallery images.`,
      });
    }

    const community = await Community.create({
      name: name.trim(),
      description: description?.trim() || "",
      rules: rules?.trim() || "",
      tags: normalizeTags(tags),
      coverImage: coverImage?.trim() || "",
      galleryImages: gallery,
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
    const { manage } = req.query;

    let communities;

    if (manage === "true") {
      // Owned + active (non-expired) moderator communities
      const memberships = await CommunityMember.find({
        user: req.user._id,
        status: "active",
        role: { $in: ["owner", "moderator"] },
      });

      const now = new Date();
      const activeMemberships = memberships.filter((m) => {
        if (m.role === "owner") return true;
        if (
          m.role === "moderator" &&
          (!m.moderatorExpiresAt || new Date(m.moderatorExpiresAt) > now)
        ) {
          return true;
        }
        return false;
      });

      const communityIds = activeMemberships.map((m) => m.community);
      const roleByCommunity = activeMemberships.reduce((acc, m) => {
        acc[String(m.community)] = getEffectiveMemberRole(m) || m.role;
        return acc;
      }, {});

      communities = await Community.find({ _id: { $in: communityIds } })
        .populate("owner", "username name email avatar")
        .sort({ createdAt: -1 });

      const countMap = await getMemberCounts(communities.map((c) => c._id));

      return res.status(200).json({
        success: true,
        communities: communities.map((community) =>
          formatCommunity(community, {
            memberCount: countMap[String(community._id)] || 0,
            membershipRole: roleByCommunity[String(community._id)] || "member",
          })
        ),
      });
    }

    communities = await Community.find({ owner: req.user._id })
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const countMap = await getMemberCounts(communities.map((c) => c._id));

    return res.status(200).json({
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
          membershipRole: "owner",
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
        message: "Only owners or admins can edit community settings.",
      });
    }

    const {
      name,
      description,
      rules,
      tags,
      coverImage,
      galleryImages,
      avatar,
      type,
    } = req.body;
    const nextCover =
      coverImage !== undefined
        ? coverImage
        : avatar !== undefined
          ? avatar
          : undefined;

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
    if (nextCover !== undefined) {
      const prevCover = community.coverImage || "";
      const nextCoverValue = String(nextCover).trim();
      community.coverImage = nextCoverValue;
      if (prevCover && prevCover !== nextCoverValue) {
        await destroyManyFromCloudinary([prevCover]);
      }
    }
    if (galleryImages !== undefined) {
      if (
        Array.isArray(galleryImages) &&
        galleryImages.length > MAX_GALLERY_IMAGES
      ) {
        return res.status(400).json({
          success: false,
          message: `You can add up to ${MAX_GALLERY_IMAGES} gallery images.`,
        });
      }
      const prevGallery = community.galleryImages || [];
      const nextGallery = normalizeGalleryImages(galleryImages);
      const removed = prevGallery.filter((url) => !nextGallery.includes(url));
      community.galleryImages = nextGallery;
      if (removed.length) {
        await destroyManyFromCloudinary(removed);
      }
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
        message: "Only owners or admins can delete a community.",
      });
    }

    const mediaToRemove = [
      community.coverImage,
      ...(community.galleryImages || []),
    ].filter(Boolean);

    await CommunityMember.deleteMany({ community: community._id });
    await CommunityJoinRequest.deleteMany({ community: community._id });
    await Community.findByIdAndDelete(req.params.id);

    if (mediaToRemove.length) {
      await destroyManyFromCloudinary(mediaToRemove);
    }

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

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
      });
    }

    const viewerRole = await getActorCommunityRole(community._id, req.user);

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
      viewerRole,
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

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
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


export const listJoinedCommunities = async (req, res) => {
  try {
    const memberships = await CommunityMember.find({
      user: req.user._id,
      status: "active",
    });

    const communityIds = memberships.map((m) => m.community);
    const communities = await Community.find({ _id: { $in: communityIds } })
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const roleMap = {};
    for (const m of memberships) {
      roleMap[String(m.community)] = m.getEffectiveRole
        ? m.getEffectiveRole()
        : m.role;
    }

    const countMap = await getMemberCounts(communities.map((c) => c._id));

    return res.status(200).json({
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
          membershipRole: roleMap[String(community._id)] || "member",
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

export const listBrowsableCommunities = async (req, res) => {
  try {
    const filter = { type: { $in: ["public", "private_request"] } };
    const q = String(req.query.q || req.query.search || "").trim();
    const tag = String(req.query.tag || "").trim().toLowerCase();
    const sortBy = String(req.query.sortBy || "newest").trim().toLowerCase();
    const pageProvided =
      req.query.page !== undefined && req.query.page !== "";
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: pageProvided ? 10 : 48,
      maxLimit: 100,
    });

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ name: regex }, { tags: regex }];
    }

    if (tag) {
      filter.tags = tag;
    }

    let memberIds = [];
    let pendingSet = new Set();

    if (req.user) {
      const memberships = await CommunityMember.find({
        user: req.user._id,
        status: "active",
      }).select("community");

      memberIds = memberships.map((m) => m.community);
      const includeJoined =
        req.query.includeJoined === "1" ||
        req.query.includeJoined === "true";
      if (memberIds.length && !includeJoined) {
        filter._id = { $nin: memberIds };
      }

      const pending = await CommunityJoinRequest.find({
        user: req.user._id,
        status: "pending",
      }).select("community");

      pendingSet = new Set(pending.map((p) => String(p.community)));
    }

    let communities = [];
    let total = null;

    if (sortBy === "members") {
      if (enabled) {
        total = await Community.countDocuments(filter);
      }

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: CommunityMember.collection.name,
            let: { communityId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$community", "$$communityId"] },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
            ],
            as: "_activeMembers",
          },
        },
        {
          $addFields: {
            memberCount: { $size: "$_activeMembers" },
          },
        },
        { $project: { _activeMembers: 0 } },
        { $sort: { memberCount: -1, createdAt: -1 } },
      ];

      if (enabled) {
        pipeline.push({ $skip: skip }, { $limit: limit });
      } else {
        pipeline.push({ $limit: limit });
      }

      pipeline.push(
        {
          $lookup: {
            from: User.collection.name,
            localField: "owner",
            foreignField: "_id",
            as: "_owner",
          },
        },
        {
          $addFields: {
            owner: { $arrayElemAt: ["$_owner", 0] },
          },
        },
        { $project: { _owner: 0 } }
      );

      communities = await Community.aggregate(pipeline);
    } else {
      const sort = resolveSort(sortBy, COMMUNITY_SORT_MAP, { createdAt: -1 });

      if (enabled) {
        total = await Community.countDocuments(filter);
        communities = await Community.find(filter)
          .populate("owner", "username name email avatar")
          .sort(sort)
          .skip(skip)
          .limit(limit);
      } else {
        communities = await Community.find(filter)
          .populate("owner", "username name email avatar")
          .sort(sort)
          .limit(limit);
      }
    }

    const countMap =
      sortBy === "members"
        ? Object.fromEntries(
            communities.map((c) => [String(c._id), c.memberCount || 0])
          )
        : await getMemberCounts(communities.map((c) => c._id));
    const memberIdSet = new Set(memberIds.map((id) => String(id)));

    const payload = {
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
          joinRequestPending: req.user
            ? pendingSet.has(String(community._id))
            : false,
          isMember: req.user
            ? memberIdSet.has(String(community._id))
            : false,
        })
      ),
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, total });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBrowsableCommunity = async (req, res) => {
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

    if (!["public", "private_request"].includes(community.type)) {
      return res.status(403).json({
        success: false,
        message: "This community is not publicly browsable.",
      });
    }

    const countMap = await getMemberCounts([community._id]);
    const extras = {
      memberCount: countMap[String(community._id)] || 0,
    };

    if (req.user) {
      const [membership, pendingRequest] = await Promise.all([
        CommunityMember.findOne({
          community: community._id,
          user: req.user._id,
          status: "active",
        }),
        CommunityJoinRequest.findOne({
          community: community._id,
          user: req.user._id,
          status: "pending",
        }),
      ]);

      extras.isMember = Boolean(membership);
      extras.membershipRole = membership?.role || null;
      extras.joinRequestPending = Boolean(pendingRequest);
    }

    return res.status(200).json({
      success: true,
      community: formatCommunity(community, extras),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listDiscoverCommunities = async (req, res) => {
  try {
    const memberships = await CommunityMember.find({
      user: req.user._id,
      status: "active",
    }).select("community");

    const memberIds = memberships.map((m) => m.community);

    const communities = await Community.find({
      _id: { $nin: memberIds },
      type: { $in: ["public", "private_request"] },
    })
      .populate("owner", "username name email avatar")
      .sort({ createdAt: -1 });

    const pending = await CommunityJoinRequest.find({
      user: req.user._id,
      status: "pending",
      community: { $in: communities.map((c) => c._id) },
    }).select("community");

    const pendingSet = new Set(pending.map((p) => String(p.community)));
    const countMap = await getMemberCounts(communities.map((c) => c._id));

    return res.status(200).json({
      success: true,
      communities: communities.map((community) =>
        formatCommunity(community, {
          memberCount: countMap[String(community._id)] || 0,
          joinRequestPending: pendingSet.has(String(community._id)),
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

export const listMyJoinRequests = async (req, res) => {
  try {
    const requests = await CommunityJoinRequest.find({ user: req.user._id })
      .populate({
        path: "community",
        populate: { path: "owner", select: "username name email avatar" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      requests: requests.map((request) => {
        const community = request.community;
        return {
          id: request._id,
          status: request.status,
          message: request.message || "",
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          community:
            community && typeof community === "object" && community._id
              ? formatCommunity(community)
              : { id: request.community },
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createJoinRequest = async (req, res) => {
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

    if (community.type !== "private_request") {
      return res.status(400).json({
        success: false,
        message: "Join requests are only allowed for private-request communities.",
      });
    }

    const bannedMember = await getBannedMembership(community._id, req.user._id);
    if (bannedMember) {
      return res.status(403).json({
        success: false,
        message: "You are banned from this community.",
      });
    }

    const existingMember = await CommunityMember.findOne({
      community: community._id,
      user: req.user._id,
      status: "active",
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this community.",
      });
    }

    const existingPending = await CommunityJoinRequest.findOne({
      community: community._id,
      user: req.user._id,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending join request for this community.",
      });
    }

    const joinRequest = await CommunityJoinRequest.create({
      community: community._id,
      user: req.user._id,
      message: String(req.body?.message || "").trim(),
      status: "pending",
    });

    await joinRequest.populate("user", "username name email avatar");

    const owner = community.owner;
    const ownerEmail =
      owner && typeof owner === "object" ? owner.email : null;
    const actionUrl = getRequestsActionUrl();
    const requesterName =
      req.user.name || req.user.username || joinRequest.user?.username || "A user";
    const ownerName =
      (owner && typeof owner === "object" && (owner.name || owner.username)) ||
      "there";

    try {
      await sendJoinRequestReceivedEmail({
        to: ownerEmail,
        ownerName,
        requesterName,
        communityName: community.name,
        actionUrl,
      });
    } catch (emailError) {
      await CommunityJoinRequest.deleteOne({ _id: joinRequest._id });
      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          "Failed to send join request email. Please try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Join request submitted. Waiting for creator approval.",
      request: formatJoinRequest(joinRequest),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const joinPublicCommunity = async (req, res) => {
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

    if (community.type !== "public") {
      return res.status(400).json({
        success: false,
        message: "Only public communities can be joined directly.",
      });
    }

    const bannedMember = await getBannedMembership(community._id, req.user._id);
    if (bannedMember) {
      return res.status(403).json({
        success: false,
        message: "You are banned from this community.",
      });
    }

    const existingMember = await CommunityMember.findOne({
      community: community._id,
      user: req.user._id,
      status: "active",
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this community.",
      });
    }

    await CommunityMember.create({
      community: community._id,
      user: req.user._id,
      role: "member",
      status: "active",
    });

    const countMap = await getMemberCounts([community._id]);

    return res.status(200).json({
      success: true,
      message: "Joined community successfully.",
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

export const listBrowsableCommunityMembers = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!["public", "private_request"].includes(community.type)) {
      return res.status(403).json({
        success: false,
        message: "This community is not publicly browsable.",
      });
    }

    if (req.user.role !== "admin") {
      const membership = await getMembership(community._id, req.user._id);
      if (!getEffectiveMemberRole(membership)) {
        return res.status(403).json({
          success: false,
          message: "You must be a member to view the member list.",
        });
      }
    }

    const members = await CommunityMember.find({
      community: community._id,
      status: "active",
    })
      .populate("user", "username name avatar")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      members: members.map(formatMember),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createCommunityInvite = async (req, res) => {
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

    if (!["private_request", "private_invite"].includes(community.type)) {
      return res.status(400).json({
        success: false,
        message: "Invites are only allowed for private communities.",
      });
    }

    if (!(await canInviteToCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only owners and moderators can invite members.",
      });
    }

    const identifier = String(
      req.body?.username || req.body?.email || req.body?.identifier || ""
    )
      .trim()
      .toLowerCase();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Provide a username or email to invite.",
      });
    }

    const invitee = await User.findOne({
      $or: [
        { username: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { email: identifier },
      ],
    }).select("username name email avatar");

    if (!invitee) {
      return res.status(404).json({
        success: false,
        message: "No user found with that username or email.",
      });
    }

    if (String(invitee._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself.",
      });
    }

    const bannedInvitee = await getBannedMembership(community._id, invitee._id);
    if (bannedInvitee) {
      return res.status(403).json({
        success: false,
        message: "That user is banned from this community.",
      });
    }

    const existingMember = await CommunityMember.findOne({
      community: community._id,
      user: invitee._id,
      status: "active",
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "That user is already a member of this community.",
      });
    }

    const existingPending = await CommunityInvite.findOne({
      community: community._id,
      invitee: invitee._id,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "A pending invite already exists for this user.",
      });
    }

    const invite = await CommunityInvite.create({
      community: community._id,
      inviter: req.user._id,
      invitee: invitee._id,
      message: String(req.body?.message || "").trim(),
      status: "pending",
    });

    await invite.populate("inviter", "username name email avatar");
    await invite.populate("invitee", "username name email avatar");
    invite.community = community;

    const inviterName =
      req.user.name || req.user.username || invite.inviter?.username || "A community owner";
    const inviteeName = invitee.name || invitee.username || "there";

    try {
      await sendCommunityInviteEmail({
        to: invitee.email,
        inviteeName,
        inviterName,
        communityName: community.name,
        actionUrl: getRequestsActionUrl(),
      });
    } catch (emailError) {
      await CommunityInvite.deleteOne({ _id: invite._id });
      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          "Failed to send invite email. Please try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Invite sent.",
      invite: formatInvite(invite),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listMyInvites = async (req, res) => {
  try {
    const invites = await CommunityInvite.find({ invitee: req.user._id })
      .populate("inviter", "username name email avatar")
      .populate("invitee", "username name email avatar")
      .populate({
        path: "community",
        populate: { path: "owner", select: "username name email avatar" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invites: invites.map(formatInvite),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listCommunityInvites = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!(await canInviteToCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only view invites for communities you manage.",
      });
    }

    const status = req.query.status || "pending";
    const filter = { community: community._id };
    if (status !== "all") {
      filter.status = status;
    }

    const invites = await CommunityInvite.find(filter)
      .populate("inviter", "username name email avatar")
      .populate("invitee", "username name email avatar")
      .populate({
        path: "community",
        populate: { path: "owner", select: "username name email avatar" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invites: invites.map(formatInvite),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const acceptCommunityInvite = async (req, res) => {
  try {
    const invite = await CommunityInvite.findById(req.params.inviteId)
      .populate("inviter", "username name email avatar")
      .populate("invitee", "username name email avatar")
      .populate({
        path: "community",
        populate: { path: "owner", select: "username name email avatar" },
      });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found.",
      });
    }

    if (String(invite.invitee._id || invite.invitee) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only accept invites sent to you.",
      });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending invites can be accepted.",
      });
    }

    const communityId = invite.community._id || invite.community;
    const bannedMember = await getBannedMembership(communityId, req.user._id);
    if (bannedMember) {
      return res.status(403).json({
        success: false,
        message: "You are banned from this community.",
      });
    }

    const priorMembership = await CommunityMember.findOne({
      community: communityId,
      user: req.user._id,
    }).lean();

    invite.status = "accepted";
    await invite.save();

    await CommunityMember.findOneAndUpdate(
      {
        community: communityId,
        user: req.user._id,
      },
      {
        community: communityId,
        user: req.user._id,
        role: "member",
        status: "active",
        bannedAt: null,
        bannedBy: null,
        moderatorExpiresAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const inviter = invite.inviter;
    const owner =
      invite.community &&
      typeof invite.community === "object" &&
      invite.community.owner;
    const recipientEmail =
      (inviter && typeof inviter === "object" && inviter.email) ||
      (owner && typeof owner === "object" && owner.email) ||
      null;
    const recipientName =
      (inviter && typeof inviter === "object" && (inviter.name || inviter.username)) ||
      (owner && typeof owner === "object" && (owner.name || owner.username)) ||
      "there";
    const inviteeName =
      req.user.name ||
      req.user.username ||
      (invite.invitee && typeof invite.invitee === "object"
        ? invite.invitee.name || invite.invitee.username
        : null) ||
      "A user";
    const communityName =
      invite.community && typeof invite.community === "object"
        ? invite.community.name
        : "your community";

    try {
      await sendCommunityInviteAcceptedEmail({
        to: recipientEmail,
        recipientName,
        inviteeName,
        communityName,
        actionUrl: getRequestsActionUrl(),
      });
    } catch (emailError) {
      invite.status = "pending";
      await invite.save();

      if (!priorMembership) {
        await CommunityMember.deleteOne({
          community: communityId,
          user: req.user._id,
        });
      } else {
        await CommunityMember.findOneAndUpdate(
          { community: communityId, user: req.user._id },
          {
            role: priorMembership.role,
            status: priorMembership.status,
            bannedAt: priorMembership.bannedAt ?? null,
            bannedBy: priorMembership.bannedBy ?? null,
            moderatorExpiresAt: priorMembership.moderatorExpiresAt ?? null,
          }
        );
      }

      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          "Failed to send invite acceptance email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invite accepted. You are now a member.",
      invite: formatInvite(invite),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const declineCommunityInvite = async (req, res) => {
  try {
    const invite = await CommunityInvite.findById(req.params.inviteId)
      .populate("inviter", "username name email avatar")
      .populate("invitee", "username name email avatar")
      .populate({
        path: "community",
        populate: { path: "owner", select: "username name email avatar" },
      });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found.",
      });
    }

    if (String(invite.invitee._id || invite.invitee) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only decline invites sent to you.",
      });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending invites can be declined.",
      });
    }

    invite.status = "declined";
    await invite.save();

    const inviter = invite.inviter;
    const owner =
      invite.community &&
      typeof invite.community === "object" &&
      invite.community.owner;
    const recipientEmail =
      (inviter && typeof inviter === "object" && inviter.email) ||
      (owner && typeof owner === "object" && owner.email) ||
      null;
    const recipientName =
      (inviter && typeof inviter === "object" && (inviter.name || inviter.username)) ||
      (owner && typeof owner === "object" && (owner.name || owner.username)) ||
      "there";
    const inviteeName =
      req.user.name ||
      req.user.username ||
      (invite.invitee && typeof invite.invitee === "object"
        ? invite.invitee.name || invite.invitee.username
        : null) ||
      "A user";
    const communityName =
      invite.community && typeof invite.community === "object"
        ? invite.community.name
        : "your community";

    try {
      await sendCommunityInviteDeclinedEmail({
        to: recipientEmail,
        recipientName,
        inviteeName,
        communityName,
        actionUrl: getRequestsActionUrl(),
      });
    } catch (emailError) {
      invite.status = "pending";
      await invite.save();

      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          "Failed to send invite decline email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invite declined.",
      invite: formatInvite(invite),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
