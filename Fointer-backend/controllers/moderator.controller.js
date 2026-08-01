import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";
import {
  canManageCommunity,
  canModerateCommunity,
  formatMember,
  getActorCommunityRole,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";

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

const assertCommunity = async (id, res) => {
  const community = await Community.findById(id);
  if (!community) {
    res.status(404).json({
      success: false,
      message: "Community not found.",
    });
    return null;
  }
  return community;
};

export const listCommunityMembers = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
      });
    }

    const status = req.query.status || "active";
    const filter = { community: community._id };
    if (status !== "all") {
      filter.status = status;
    }

    const members = await CommunityMember.find(filter)
      .populate("user", "username name email avatar")
      .sort({ role: 1, createdAt: -1 });

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

export const listModerators = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only view moderators for communities you manage.",
      });
    }

    const moderators = await CommunityMember.find({
      community: community._id,
      status: "active",
      role: "moderator",
    })
      .populate("user", "username name email avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      moderators: moderators
        .filter((m) => getEffectiveMemberRole(m) === "moderator")
        .map(formatMember),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const assignModerator = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only owners or admins can assign moderators.",
      });
    }

    const { userId, expiresAt } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    if (String(userId) === String(community.owner)) {
      return res.status(400).json({
        success: false,
        message: "Community owner is already the owner.",
      });
    }

    let membership = await CommunityMember.findOne({
      community: community._id,
      user: userId,
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "User must be an active community member before becoming a moderator.",
      });
    }

    if (membership.status === "banned") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a banned member as moderator.",
      });
    }

    if (membership.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Cannot change the owner to moderator here.",
      });
    }

    membership.role = "moderator";
    membership.moderatorExpiresAt = expiresAt ? new Date(expiresAt) : null;
    membership.status = "active";
    membership.bannedAt = null;
    membership.bannedBy = null;
    await membership.save();
    await membership.populate("user", "username name email avatar");

    return res.status(200).json({
      success: true,
      message: "Moderator assigned.",
      member: formatMember(membership),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const revokeModerator = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!canManageCommunity(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only owners or admins can revoke moderators.",
      });
    }

    const membership = await CommunityMember.findOne({
      community: community._id,
      user: req.params.userId,
      status: "active",
    }).populate("user", "username name email avatar");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Moderator membership not found.",
      });
    }

    if (membership.role !== "moderator") {
      return res.status(400).json({
        success: false,
        message: "Target user is not a moderator.",
      });
    }

    membership.role = "member";
    membership.moderatorExpiresAt = null;
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Moderator removed successfully.",
      member: formatMember(membership),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeMemberRole = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    const actorRole = await getActorCommunityRole(community._id, req.user);
    if (!actorRole || !["admin", "owner", "moderator"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
      });
    }

    const membership = await CommunityMember.findOne({
      _id: req.params.memberId,
      community: community._id,
    }).populate("user", "username name email avatar");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Member not found.",
      });
    }

    if (membership.status === "banned") {
      return res.status(400).json({
        success: false,
        message: "Member is banned. Unban them first or leave them banned.",
      });
    }

    if (membership.role === "owner") {
      if (actorRole === "moderator") {
        return res.status(403).json({
          success: false,
          message: "Moderators cannot remove owners.",
        });
      }
      const ownerCount = await CommunityMember.countDocuments({
        community: community._id,
        role: "owner",
        status: "active",
      });
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot remove the last owner.",
        });
      }
    }

    if (
      actorRole === "moderator" &&
      (membership.role === "moderator" || membership.role === "owner")
    ) {
      return res.status(403).json({
        success: false,
        message: "Moderators cannot modify other moderators or owners.",
      });
    }

    const removeEntirely = Boolean(req.body?.removeEntirely);
    if (removeEntirely) {
      await membership.deleteOne();
      return res.status(200).json({
        success: true,
        message: "Member removed from community.",
      });
    }

    membership.role = "member";
    membership.moderatorExpiresAt = null;
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Role removed; user is now a member.",
      member: formatMember(membership),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const banMember = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    const actorRole = await getActorCommunityRole(community._id, req.user);
    if (!actorRole || !["admin", "owner", "moderator"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
      });
    }

    const membership = await CommunityMember.findOne({
      _id: req.params.memberId,
      community: community._id,
    }).populate("user", "username name email avatar");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Member not found.",
      });
    }

    if (membership.status === "banned") {
      return res.status(400).json({
        success: false,
        message: "Member is already banned.",
      });
    }

    if (membership.role === "owner") {
      return res.status(403).json({
        success: false,
        message: "Cannot ban the community owner.",
      });
    }

    if (actorRole === "moderator" && membership.role === "moderator") {
      return res.status(403).json({
        success: false,
        message: "Moderators cannot ban other moderators.",
      });
    }

    membership.status = "banned";
    membership.role = "member";
    membership.moderatorExpiresAt = null;
    membership.bannedAt = new Date();
    membership.bannedBy = req.user._id;
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Member banned from community.",
      member: formatMember(membership),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const unbanMember = async (req, res) => {
  try {
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    const actorRole = await getActorCommunityRole(community._id, req.user);
    if (!actorRole || !["admin", "owner", "moderator"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
      });
    }

    const membership = await CommunityMember.findOne({
      _id: req.params.memberId,
      community: community._id,
      status: "banned",
    }).populate("user", "username name email avatar");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Banned member not found.",
      });
    }

    membership.status = "active";
    membership.role = "member";
    membership.moderatorExpiresAt = null;
    membership.bannedAt = null;
    membership.bannedBy = null;
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Member unbanned.",
      member: formatMember(membership),
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
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
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

    const userId = joinRequest.user._id || joinRequest.user;
    const banned = await CommunityMember.findOne({
      community: community._id,
      user: userId,
      status: "banned",
    });

    if (banned) {
      return res.status(403).json({
        success: false,
        message: "This user is banned from the community.",
      });
    }

    joinRequest.status = "approved";
    await joinRequest.save();

    await CommunityMember.findOneAndUpdate(
      { community: community._id, user: userId },
      {
        community: community._id,
        user: userId,
        role: "member",
        status: "active",
        bannedAt: null,
        bannedBy: null,
        moderatorExpiresAt: null,
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
    const community = await assertCommunity(req.params.id, res);
    if (!community) return;

    if (!(await canModerateCommunity(community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only manage communities you moderate.",
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
