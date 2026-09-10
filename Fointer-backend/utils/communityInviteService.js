import CommunityMember from "../models/communityMember.js";
import CommunityInvite from "../models/communityInvite.js";
import User from "../models/user.js";
import { getBannedMembership } from "./communityPermissions.js";
import { escapeRegex } from "./validate.js";
import {
  getCommunitiesInvitesUrl,
  sendCommunityInviteEmail,
} from "./sendVerificationEmail.js";
import { notify, personName } from "./notify.js";

export const formatInviteUserRef = (user, fallbackId) => {
  if (user && typeof user === "object" && user._id) {
    return {
      id: user._id,
      username: user.username,
      name: user.name,
      avatar: user.avatar || "",
    };
  }
  return { id: fallbackId };
};

export const formatInvite = (invite, formatCommunity) => ({
  id: invite._id,
  status: invite.status,
  message: invite.message || "",
  createdAt: invite.createdAt,
  updatedAt: invite.updatedAt,
  inviter: formatInviteUserRef(invite.inviter, invite.inviter),
  invitee: formatInviteUserRef(invite.invitee, invite.invitee),
  community:
    invite.community &&
    typeof invite.community === "object" &&
    invite.community._id
      ? formatCommunity
        ? formatCommunity(invite.community)
        : {
            id: invite.community._id,
            name: invite.community.name,
            type: invite.community.type,
          }
      : { id: invite.community },
});

export async function resolveInviteeUser({
  userId,
  username,
  email,
  identifier,
}) {
  const id = String(userId || "").trim();
  if (id) {
    return User.findById(id).select("username name email avatar");
  }

  const byUsername = String(username || "").trim();
  if (byUsername) {
    return User.findOne({
      username: new RegExp(`^${escapeRegex(byUsername)}$`, "i"),
    }).select("username name email avatar");
  }

  const lookup = String(identifier || email || "")
    .trim()
    .toLowerCase();
  if (!lookup) return null;

  return User.findOne({
    $or: [
      {
        username: new RegExp(
          `^${lookup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
      { email: lookup },
    ],
  }).select("username name email avatar");
}

export async function assertInviteeEligible(communityId, inviteeId, inviterId) {
  if (String(inviteeId) === String(inviterId)) {
    return { status: 400, message: "You cannot invite yourself." };
  }

  const bannedInvitee = await getBannedMembership(communityId, inviteeId);
  if (bannedInvitee) {
    return {
      status: 403,
      message: "That user is banned from this community.",
    };
  }

  const existingMember = await CommunityMember.findOne({
    community: communityId,
    user: inviteeId,
    status: "active",
  });

  if (existingMember) {
    return {
      status: 400,
      message: "That user is already a member of this community.",
    };
  }

  const existingPending = await CommunityInvite.findOne({
    community: communityId,
    invitee: inviteeId,
    status: "pending",
  });

  if (existingPending) {
    return {
      status: 400,
      message: "A pending invite already exists for this user.",
    };
  }

  return null;
}

export async function createAndDeliverCommunityInvite({
  community,
  inviter,
  invitee,
  message = "",
  io,
  formatCommunity,
}) {
  const invite = await CommunityInvite.create({
    community: community._id,
    inviter: inviter._id,
    invitee: invitee._id,
    message: String(message || "").trim(),
    status: "pending",
  });

  await invite.populate("inviter", "username name email avatar");
  await invite.populate("invitee", "username name email avatar");
  invite.community = community;

  const inviterName =
    inviter.name ||
    inviter.username ||
    invite.inviter?.username ||
    "A community owner";
  const inviteeName = invitee.name || invitee.username || "there";

  try {
    await sendCommunityInviteEmail({
      to: invitee.email,
      inviteeName,
      inviterName,
      communityName: community.name,
      actionUrl: getCommunitiesInvitesUrl(),
    });
  } catch (emailError) {
    await CommunityInvite.deleteOne({ _id: invite._id });
    throw emailError;
  }

  await notify({
    io,
    recipientId: invitee._id,
    actor: inviter,
    type: "invite",
    title: `${personName(inviter)} invited you to join ${community.name}`,
    body: invite.message || "",
    entity: { kind: "invite", id: invite._id },
    community,
  });

  return formatInvite(invite, formatCommunity);
}
