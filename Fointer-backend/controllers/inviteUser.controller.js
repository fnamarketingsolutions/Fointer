import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityInvite from "../models/communityInvite.js";
import User from "../models/user.js";
import {
  getBannedMembership,
  canManageCommunity,
} from "../utils/communityPermissions.js";
import {
  getRequestsActionUrl,
  sendCommunityInviteEmail,
} from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";
import { notify, personName } from "../utils/notify.js";

const formatInviteUser = (user, fallbackId, { includeEmail = false } = {}) => {
  if (user && typeof user === "object" && user._id) {
    const ref = {
      id: user._id,
      username: user.username,
      name: user.name,
      avatar: user.avatar || "",
    };
    if (includeEmail && user.email) ref.email = user.email;
    return ref;
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
        ? {
            id: community._id,
            name: community.name,
            type: community.type,
          }
        : { id: invite.community },
  };
};

const assertOwnerCanInvite = (community, user) => {
  if (!canManageCommunity(community, user)) {
    return false;
  }
  return true;
};

export const lookupInviteUser = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (!assertOwnerCanInvite(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only the community owner can look up users to invite.",
      });
    }

    if (!["private_request", "private_invite"].includes(community.type)) {
      return res.status(400).json({
        success: false,
        message: "Invites are only allowed for private communities.",
      });
    }

    const query = String(req.query.username || req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Provide a username or email to look up.",
      });
    }

    if (query.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Type at least 3 characters ",
      });
    }

    const contains = new RegExp(escapeRegex(query), "i");
    const users = await User.find({
      $or: [{ username: contains }, { email: contains }],
    })
      .select("username name email avatar")
      .limit(10);

    // Owner invite lookup may include email so the owner can confirm the person.
    return res.status(200).json({
      success: true,
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        name: user.name || "",
        email: user.email,
        avatar: user.avatar || "",
      })),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const inviteUserToCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

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

    if (!assertOwnerCanInvite(community, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only the community owner can invite members.",
      });
    }

    const username = String(req.body?.username || "").trim();
    const userId = String(req.body?.userId || "").trim();

    let invitee = null;
    if (userId) {
      invitee = await User.findById(userId).select("username name email avatar");
    } else if (username) {
      invitee = await User.findOne({
        username: new RegExp(`^${escapeRegex(username)}$`, "i"),
      }).select("username name email avatar");
    }

    if (!invitee) {
      return res.status(404).json({
        success: false,
        message: "No user found with that username.",
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
    const inviteeName =
      invitee.name || invitee.username || "there";

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

    await notify({
      io: req.app.get("io"),
      recipientId: invitee._id,
      actor: req.user,
      type: "invite",
      title: `${personName(req.user)} invited you to join ${community.name}`,
      body: invite.message || "",
      entity: { kind: "invite", id: invite._id },
      community,
    });

    return res.status(201).json({
      success: true,
      message: "Invite sent.",
      invite: formatInvite(invite),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
