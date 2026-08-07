import Community from "../models/community.js";
import WatchGroup, {
  WATCH_GROUP_TYPES,
  DEFAULT_MAX_PARTICIPANTS,
  ABSOLUTE_MAX_PARTICIPANTS,
} from "../models/watchGroup.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import WatchGroupJoinRequest from "../models/watchGroupJoinRequest.js";
import CommunityMember from "../models/communityMember.js";
import {
  canEngageInCommunity,
  canModerateCommunity,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";
import { resolveDocumentId } from "../utils/shortCode.js";

const formatUser = (user) => {
  if (!user || typeof user !== "object" || !user._id) {
    return user ? { id: user } : null;
  }
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
  };
};

const formatCommunityBrief = (community) => {
  if (!community || typeof community !== "object" || !community._id) {
    return community ? { id: community } : null;
  }
  return {
    id: community._id,
    shortCode: community.shortCode || null,
    name: community.name,
  };
};

export const formatWatchGroup = (group, extras = {}) => {
  const participantCount =
    extras.participantCount != null
      ? extras.participantCount
      : Array.isArray(group.participantCount)
        ? group.participantCount[0]?.count
        : undefined;

  return {
    id: group._id,
    shortCode: group.shortCode || null,
    name: group.name,
    type: group.type,
    maxParticipants: group.maxParticipants,
    status: group.status,
    community: formatCommunityBrief(group.community),
    createdBy: formatUser(group.createdBy),
    participantCount:
      participantCount != null ? Number(participantCount) : extras.participantCount ?? 1,
    myRole: extras.myRole || null,
    myJoinRequestStatus:
      extras.myJoinRequestStatus !== undefined
        ? extras.myJoinRequestStatus
        : null,
    pendingRequestCount:
      extras.pendingRequestCount != null
        ? Number(extras.pendingRequestCount)
        : undefined,
    canManage: Boolean(extras.canManage),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const formatJoinRequest = (request) => ({
  id: request._id,
  status: request.status,
  message: request.message || "",
  user: formatUser(request.user),
  watchGroup: request.watchGroup?._id || request.watchGroup || null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

const resolveCommunity = async (value) => {
  const id = await resolveDocumentId(Community, value);
  if (!id) return null;
  return Community.findById(id);
};

const resolveWatchGroup = async (value) => {
  const id = await resolveDocumentId(WatchGroup, value);
  if (!id) return null;
  return WatchGroup.findById(id)
    .populate("community", "name shortCode")
    .populate("createdBy", "username name avatar");
};

const getActiveParticipantCount = async (watchGroupId) =>
  WatchGroupMember.countDocuments({
    watchGroup: watchGroupId,
    status: "active",
  });

const ensureCommunityMemberForGroup = async (group, user) => {
  if (!group?.community) {
    return { ok: false, code: 404, message: "Watch group not found." };
  }
  const communityId = group.community._id || group.community;
  const canEngage = await canEngageInCommunity(communityId, user);
  if (!canEngage) {
    return {
      ok: false,
      code: 403,
      message: "Only community members can join watch groups.",
    };
  }
  return { ok: true };
};

const upsertActiveMember = async (watchGroupId, userId) => {
  const existing = await WatchGroupMember.findOne({
    watchGroup: watchGroupId,
    user: userId,
  });

  if (existing) {
    existing.status = "active";
    if (!existing.role) existing.role = "member";
    await existing.save();
    return existing;
  }

  return WatchGroupMember.create({
    watchGroup: watchGroupId,
    user: userId,
    role: "member",
    status: "active",
  });
};

/**
 * Create a watch group within a community.
 * Allowed for active community members (member, moderator, owner) and platform admins.
 */
export const createWatchGroup = async (req, res) => {
  try {
    const { name, type, maxParticipants, communityId, community: communityInput } =
      req.body;

    const communityRef = communityId || communityInput;
    if (!communityRef) {
      return res.status(400).json({
        success: false,
        message: "Community is required.",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
      });
    }

    const community = await resolveCommunity(communityRef);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    const canCreate = await canEngageInCommunity(community._id, req.user);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message: "Only community members can create watch groups.",
      });
    }

    const groupType = type || "public";
    if (!WATCH_GROUP_TYPES.includes(groupType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Allowed: ${WATCH_GROUP_TYPES.join(", ")}.`,
      });
    }

    let max = DEFAULT_MAX_PARTICIPANTS;
    if (maxParticipants != null && maxParticipants !== "") {
      max = Number(maxParticipants);
      if (!Number.isFinite(max) || !Number.isInteger(max)) {
        return res.status(400).json({
          success: false,
          message: "Max participants must be a whole number.",
        });
      }
      if (max < 2 || max > ABSOLUTE_MAX_PARTICIPANTS) {
        return res.status(400).json({
          success: false,
          message: `Max participants must be between 2 and ${ABSOLUTE_MAX_PARTICIPANTS}.`,
        });
      }
    }

    const group = await WatchGroup.create({
      name: String(name).trim(),
      type: groupType,
      maxParticipants: max,
      community: community._id,
      createdBy: req.user._id,
      status: "active",
    });

    await WatchGroupMember.create({
      watchGroup: group._id,
      user: req.user._id,
      role: "owner",
      status: "active",
    });

    const populated = await WatchGroup.findById(group._id)
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Watch group created successfully.",
      watchGroup: formatWatchGroup(populated, {
        participantCount: 1,
        myRole: "owner",
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * List watch groups for the current user:
 * - With communityId: all active groups in that community (members only)
 * - Without: groups in communities the user belongs to (joinable + joined)
 */
export const listWatchGroups = async (req, res) => {
  try {
    const communityRef = req.query.communityId || req.query.community;
    const filter = { status: "active" };

    if (communityRef) {
      const community = await resolveCommunity(communityRef);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found.",
        });
      }

      const canView = await canEngageInCommunity(community._id, req.user);
      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "Only community members can view watch groups.",
        });
      }

      filter.community = community._id;
    } else {
      // Groups in communities the user belongs to (joinable), plus any
      // groups they already joined (in case membership lapsed).
      const [communityMemberships, groupMemberships] = await Promise.all([
        CommunityMember.find({
          user: req.user._id,
          status: "active",
        })
          .select("community")
          .lean(),
        WatchGroupMember.find({
          user: req.user._id,
          status: "active",
        })
          .select("watchGroup")
          .lean(),
      ]);

      const communityIds = communityMemberships.map((m) => m.community);
      const memberGroupIds = groupMemberships.map((m) => m.watchGroup);

      if (!communityIds.length && !memberGroupIds.length) {
        return res.status(200).json({
          success: true,
          watchGroups: [],
        });
      }

      const or = [];
      if (communityIds.length) {
        or.push({ community: { $in: communityIds } });
      }
      if (memberGroupIds.length) {
        or.push({ _id: { $in: memberGroupIds } });
      }
      filter.$or = or;
    }

    const groups = await WatchGroup.find(filter)
      .sort({ createdAt: -1 })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean();

    const groupIds = groups.map((g) => g._id);
    const [counts, myMemberships, myPendingRequests, pendingCounts] =
      await Promise.all([
        WatchGroupMember.aggregate([
          { $match: { watchGroup: { $in: groupIds }, status: "active" } },
          { $group: { _id: "$watchGroup", count: { $sum: 1 } } },
        ]),
        WatchGroupMember.find({
          watchGroup: { $in: groupIds },
          user: req.user._id,
          status: "active",
        })
          .select("watchGroup role")
          .lean(),
        WatchGroupJoinRequest.find({
          watchGroup: { $in: groupIds },
          user: req.user._id,
          status: "pending",
        })
          .select("watchGroup")
          .lean(),
        WatchGroupJoinRequest.aggregate([
          {
            $match: {
              watchGroup: { $in: groupIds },
              status: "pending",
            },
          },
          { $group: { _id: "$watchGroup", count: { $sum: 1 } } },
        ]),
      ]);

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const roleMap = new Map(
      myMemberships.map((m) => [String(m.watchGroup), m.role])
    );
    const pendingMine = new Set(
      myPendingRequests.map((r) => String(r.watchGroup))
    );
    const pendingCountMap = new Map(
      pendingCounts.map((c) => [String(c._id), c.count])
    );

    const communityIds = [
      ...new Set(
        groups
          .map((g) => String(g.community?._id || g.community || ""))
          .filter(Boolean)
      ),
    ];

    const moderateCommunityIds = new Set();
    if (req.user.role === "admin") {
      communityIds.forEach((id) => moderateCommunityIds.add(id));
    } else if (communityIds.length) {
      const communityMemberships = await CommunityMember.find({
        community: { $in: communityIds },
        user: req.user._id,
        status: "active",
      }).lean();
      for (const membership of communityMemberships) {
        const role = getEffectiveMemberRole(membership);
        if (role === "owner" || role === "moderator") {
          moderateCommunityIds.add(String(membership.community));
        }
      }
    }

    return res.status(200).json({
      success: true,
      watchGroups: groups.map((g) => {
        const id = String(g._id);
        const myRole = roleMap.get(id) || null;
        const isOwner =
          myRole === "owner" ||
          String(g.createdBy?._id || g.createdBy) === String(req.user._id);
        const communityId = String(g.community?._id || g.community || "");
        const canManage =
          isOwner ||
          req.user.role === "admin" ||
          moderateCommunityIds.has(communityId);
        return formatWatchGroup(g, {
          participantCount: countMap.get(id) || 0,
          myRole,
          myJoinRequestStatus: pendingMine.has(id) ? "pending" : null,
          pendingRequestCount: isOwner ? pendingCountMap.get(id) || 0 : undefined,
          canManage,
        });
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Communities the user can create a watch group in (active membership).
 */
export const getWatchGroupCreateContext = async (req, res) => {
  try {
    const rows = await CommunityMember.find({
      user: req.user._id,
      status: "active",
    })
      .populate("community", "name shortCode type")
      .lean();

    const communities = rows
      .map((row) => {
        const role = getEffectiveMemberRole(row);
        if (!role || !row.community) return null;
        return {
          id: row.community._id,
          shortCode: row.community.shortCode || null,
          name: row.community.name,
          type: row.community.type,
          membershipRole: role,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      communities,
      defaults: {
        maxParticipants: DEFAULT_MAX_PARTICIPANTS,
        type: "public",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Join a public watch group (community members only).
 */
export const joinWatchGroup = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (group.type !== "public") {
      return res.status(400).json({
        success: false,
        message: "Private watch groups require a join request.",
      });
    }

    const access = await ensureCommunityMemberForGroup(group, req.user);
    if (!access.ok) {
      return res.status(access.code).json({
        success: false,
        message: access.message,
      });
    }

    const existing = await WatchGroupMember.findOne({
      watchGroup: group._id,
      user: req.user._id,
      status: "active",
    }).lean();

    if (existing) {
      const participantCount = await getActiveParticipantCount(group._id);
      return res.status(200).json({
        success: true,
        message: "Already a member of this watch group.",
        watchGroup: formatWatchGroup(group.toObject ? group.toObject() : group, {
          participantCount,
          myRole: existing.role,
          myJoinRequestStatus: null,
        }),
      });
    }

    const participantCount = await getActiveParticipantCount(group._id);
    if (participantCount >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    const membership = await upsertActiveMember(group._id, req.user._id);
    const lean = group.toObject ? group.toObject() : group;

    return res.status(200).json({
      success: true,
      message: "Joined watch group successfully.",
      watchGroup: formatWatchGroup(lean, {
        participantCount: participantCount + 1,
        myRole: membership.role,
        myJoinRequestStatus: null,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Request to join a private watch group.
 */
export const createWatchGroupJoinRequest = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (group.type !== "private") {
      return res.status(400).json({
        success: false,
        message: "Public watch groups can be joined directly.",
      });
    }

    const access = await ensureCommunityMemberForGroup(group, req.user);
    if (!access.ok) {
      return res.status(access.code).json({
        success: false,
        message: access.message,
      });
    }

    const existingMember = await WatchGroupMember.findOne({
      watchGroup: group._id,
      user: req.user._id,
      status: "active",
    }).lean();

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this watch group.",
      });
    }

    const existingPending = await WatchGroupJoinRequest.findOne({
      watchGroup: group._id,
      user: req.user._id,
      status: "pending",
    });

    if (existingPending) {
      return res.status(200).json({
        success: true,
        message: "Join request already pending.",
        request: formatJoinRequest(existingPending),
        myJoinRequestStatus: "pending",
      });
    }

    const joinRequest = await WatchGroupJoinRequest.create({
      watchGroup: group._id,
      user: req.user._id,
      status: "pending",
      message: String(req.body?.message || "").trim(),
    });

    await joinRequest.populate("user", "username name avatar");

    return res.status(201).json({
      success: true,
      message: "Join request submitted.",
      request: formatJoinRequest(joinRequest),
      myJoinRequestStatus: "pending",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const assertGroupOwner = async (group, user) => {
  if (!group) {
    return { ok: false, code: 404, message: "Watch group not found." };
  }
  const creatorId = group.createdBy?._id || group.createdBy;
  const ownerMembership = await WatchGroupMember.findOne({
    watchGroup: group._id,
    user: user._id,
    role: "owner",
    status: "active",
  }).lean();

  if (
    String(creatorId) !== String(user._id) &&
    !ownerMembership &&
    user.role !== "admin"
  ) {
    return {
      ok: false,
      code: 403,
      message: "Only the watch group owner can manage join requests.",
    };
  }
  return { ok: true };
};

const getGroupCommunityRef = (group) => {
  if (!group?.community) return null;
  if (group.community._id) return group.community;
  return { _id: group.community };
};

/**
 * Group admin (creator / owner role / platform admin) OR community moderator/owner.
 */
const canManageWatchGroup = async (group, user) => {
  if (!group) {
    return {
      ok: false,
      code: 404,
      message: "Watch group not found.",
      isGroupOwner: false,
      isCommunityModerator: false,
    };
  }

  const ownerCheck = await assertGroupOwner(group, user);
  if (ownerCheck.ok) {
    const community = getGroupCommunityRef(group);
    const isCommunityModerator = community
      ? await canModerateCommunity(community, user)
      : user.role === "admin";
    return {
      ok: true,
      isGroupOwner: true,
      isCommunityModerator,
    };
  }

  const community = getGroupCommunityRef(group);
  if (!community?._id) {
    return {
      ok: false,
      code: 403,
      message: "You do not have permission to manage this watch group.",
      isGroupOwner: false,
      isCommunityModerator: false,
    };
  }

  const isCommunityModerator = await canModerateCommunity(community, user);
  if (isCommunityModerator) {
    return {
      ok: true,
      isGroupOwner: false,
      isCommunityModerator: true,
    };
  }

  return {
    ok: false,
    code: 403,
    message: "You do not have permission to manage this watch group.",
    isGroupOwner: false,
    isCommunityModerator: false,
  };
};

/**
 * List pending join requests for a watch group (owner only).
 */
export const listWatchGroupJoinRequests = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const ownerCheck = await assertGroupOwner(group, req.user);
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.code).json({
        success: false,
        message: ownerCheck.message,
      });
    }

    const status = String(req.query.status || "pending").trim().toLowerCase();
    const filter = { watchGroup: group._id };
    if (["pending", "approved", "denied"].includes(status)) {
      filter.status = status;
    }

    const requests = await WatchGroupJoinRequest.find(filter)
      .populate("user", "username name avatar")
      .sort({ createdAt: -1 })
      .lean();

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

/**
 * Approve a private watch group join request (owner only).
 */
export const approveWatchGroupJoinRequest = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const ownerCheck = await assertGroupOwner(group, req.user);
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.code).json({
        success: false,
        message: ownerCheck.message,
      });
    }

    const joinRequest = await WatchGroupJoinRequest.findOne({
      _id: req.params.requestId,
      watchGroup: group._id,
    }).populate("user", "username name avatar");

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

    const userId = joinRequest.user._id || joinRequest.user;
    const participantCount = await getActiveParticipantCount(group._id);
    if (participantCount >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    joinRequest.status = "approved";
    await joinRequest.save();
    await upsertActiveMember(group._id, userId);

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

/**
 * Deny a private watch group join request (owner only).
 */
export const denyWatchGroupJoinRequest = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const ownerCheck = await assertGroupOwner(group, req.user);
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.code).json({
        success: false,
        message: ownerCheck.message,
      });
    }

    const joinRequest = await WatchGroupJoinRequest.findOne({
      _id: req.params.requestId,
      watchGroup: group._id,
    }).populate("user", "username name avatar");

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

/**
 * Soft-close a watch group (group admin or community moderator). Sets status to "closed".
 */
export const closeWatchGroup = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const manageCheck = await canManageWatchGroup(group, req.user);
    if (!manageCheck.ok) {
      return res.status(manageCheck.code).json({
        success: false,
        message: "Only the watch group owner or a community moderator can delete this group.",
      });
    }

    group.status = "closed";
    await group.save();

    return res.status(200).json({
      success: true,
      message: "Watch group deleted.",
      watchGroup: formatWatchGroup(group, { canManage: true }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove a member from a watch group (group admin or community moderator).
 * Community moderators may remove the group creator / owner-role members.
 */
export const removeWatchGroupMember = async (req, res) => {
  try {
    const group = await resolveWatchGroup(req.params.groupId);
    if (!group || group.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const manageCheck = await canManageWatchGroup(group, req.user);
    if (!manageCheck.ok) {
      return res.status(manageCheck.code).json({
        success: false,
        message: "Only the watch group owner or a community moderator can remove members.",
      });
    }

    const targetUserId = req.params.userId;
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Member id is required.",
      });
    }

    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove yourself from the group.",
      });
    }

    const creatorId = group.createdBy?._id || group.createdBy;
    const isTargetCreator = String(targetUserId) === String(creatorId);

    const membership = await WatchGroupMember.findOne({
      watchGroup: group._id,
      user: targetUserId,
    });

    if (!membership || membership.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Member not found in this watch group.",
      });
    }

    const isTargetOwnerRole = membership.role === "owner";
    if (
      (isTargetCreator || isTargetOwnerRole) &&
      !manageCheck.isCommunityModerator
    ) {
      return res.status(400).json({
        success: false,
        message: "The group administrator cannot be removed.",
      });
    }

    membership.status = "removed";
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Member removed from watch group.",
      userId: targetUserId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
