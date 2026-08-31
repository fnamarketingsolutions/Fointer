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
import {
  getRequestsActionUrl,
  sendJoinRequestApprovedEmail,
  sendJoinRequestDeniedEmail,
} from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { notify } from "../utils/notify.js";

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
    return sendServerError(res, error);
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
    return sendServerError(res, error);
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

    const previousRole = membership.role;
    membership.role = "moderator";
    membership.moderatorExpiresAt = expiresAt ? new Date(expiresAt) : null;
    membership.status = "active";
    membership.bannedAt = null;
    membership.bannedBy = null;
    await membership.save();
    await membership.populate("user", "username name email avatar");

    if (previousRole !== "moderator") {
      await notify({
        io: req.app.get("io"),
        recipientId: userId,
        actor: req.user,
        type: "moderator_assigned",
        title: `You were made a moderator of ${community.name}`,
        entity: {
          kind: "community",
          id: community._id,
          shortCode: community.shortCode,
          title: community.name,
        },
        community,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Moderator assigned.",
      member: formatMember(membership),
    });
  } catch (error) {
    return sendServerError(res, error);
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

    await notify({
      io: req.app.get("io"),
      recipientId: membership.user?._id || membership.user,
      actor: req.user,
      type: "moderator_revoked",
      title: `Your moderator role in ${community.name} was removed`,
      entity: {
        kind: "community",
        id: community._id,
        shortCode: community.shortCode,
        title: community.name,
      },
      community,
    });

    return res.status(200).json({
      success: true,
      message: "Moderator removed successfully.",
      member: formatMember(membership),
    });
  } catch (error) {
    return sendServerError(res, error);
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
    const targetUserId = membership.user?._id || membership.user;
    const previousRole = membership.role;
    if (removeEntirely) {
      await membership.deleteOne();
      await notify({
        io: req.app.get("io"),
        recipientId: targetUserId,
        actor: req.user,
        type: "member_removed",
        title: `You were removed from ${community.name}`,
        entity: {
          kind: "community",
          id: community._id,
          shortCode: community.shortCode,
          title: community.name,
        },
        community,
      });
      return res.status(200).json({
        success: true,
        message: "Member removed from community.",
      });
    }

    membership.role = "member";
    membership.moderatorExpiresAt = null;
    await membership.save();

    if (previousRole === "moderator") {
      await notify({
        io: req.app.get("io"),
        recipientId: targetUserId,
        actor: req.user,
        type: "moderator_revoked",
        title: `Your moderator role in ${community.name} was removed`,
        entity: {
          kind: "community",
          id: community._id,
          shortCode: community.shortCode,
          title: community.name,
        },
        community,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role removed; user is now a member.",
      member: formatMember(membership),
    });
  } catch (error) {
    return sendServerError(res, error);
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

    await notify({
      io: req.app.get("io"),
      recipientId: membership.user?._id || membership.user,
      actor: req.user,
      type: "member_banned",
      title: `You were banned from ${community.name}`,
      entity: {
        kind: "community",
        id: community._id,
        shortCode: community.shortCode,
        title: community.name,
      },
      community,
    });

    return res.status(200).json({
      success: true,
      message: "Member banned from community.",
      member: formatMember(membership),
    });
  } catch (error) {
    return sendServerError(res, error);
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

    await notify({
      io: req.app.get("io"),
      recipientId: membership.user?._id || membership.user,
      actor: req.user,
      type: "member_unbanned",
      title: `You were unbanned from ${community.name}`,
      entity: {
        kind: "community",
        id: community._id,
        shortCode: community.shortCode,
        title: community.name,
      },
      community,
    });

    return res.status(200).json({
      success: true,
      message: "Member unbanned.",
      member: formatMember(membership),
    });
  } catch (error) {
    return sendServerError(res, error);
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

    const priorMembership = await CommunityMember.findOne({
      community: community._id,
      user: userId,
    }).lean();

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

    const requester = joinRequest.user;
    const requesterEmail =
      requester && typeof requester === "object" ? requester.email : null;
    const actionUrl = getRequestsActionUrl();
    const userName =
      (requester && typeof requester === "object" &&
        (requester.name || requester.username)) ||
      "there";

    try {
      await sendJoinRequestApprovedEmail({
        to: requesterEmail,
        userName,
        communityName: community.name,
        actionUrl,
      });
    } catch (emailError) {
      joinRequest.status = "pending";
      await joinRequest.save();

      if (!priorMembership) {
        await CommunityMember.deleteOne({
          community: community._id,
          user: userId,
        });
      } else {
        await CommunityMember.findOneAndUpdate(
          { community: community._id, user: userId },
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
          "Failed to send approval email. Please try again.",
      });
    }

    await notify({
      io: req.app.get("io"),
      recipientId: userId,
      actor: req.user,
      type: "join_request_approved",
      title: `Your request to join ${community.name} was approved`,
      body: "You are now a member.",
      entity: { kind: "join_request", id: joinRequest._id },
      community,
    });

    return res.status(200).json({
      success: true,
      message: "Join request approved.",
      request: formatJoinRequest(joinRequest),
    });
  } catch (error) {
    return sendServerError(res, error);
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

    const requester = joinRequest.user;
    const requesterEmail =
      requester && typeof requester === "object" ? requester.email : null;
    const actionUrl = getRequestsActionUrl();
    const userName =
      (requester &&
        typeof requester === "object" &&
        (requester.name || requester.username)) ||
      "there";

    try {
      await sendJoinRequestDeniedEmail({
        to: requesterEmail,
        userName,
        communityName: community.name,
        actionUrl,
      });
    } catch (emailError) {
      joinRequest.status = "pending";
      await joinRequest.save();

      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          "Failed to send rejection email. Please try again.",
      });
    }

    await notify({
      io: req.app.get("io"),
      recipientId: joinRequest.user?._id || joinRequest.user,
      actor: req.user,
      type: "join_request_denied",
      title: `Your request to join ${community.name} was rejected`,
      entity: { kind: "join_request", id: joinRequest._id },
      community,
    });

    return res.status(200).json({
      success: true,
      message: "Join request denied.",
      request: formatJoinRequest(joinRequest),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
