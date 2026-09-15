import WatchGroup, {
  WATCH_GROUP_TYPES,
} from "../models/watchGroup.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import WatchGroupMessage from "../models/watchGroupMessage.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import { resolveDocumentId } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { getWatchGroupCreateLimits } from "../utils/watchGroupLimits.js";
import { hasWatchGroupsAdminPower } from "../utils/adminAccess.js";
import { notify, personName } from "../utils/notify.js";

const isValidMemberId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || ""));

const formatUser = (user) => {
  if (!user || typeof user !== "object" || !user._id) {
    return { id: user };
  }
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
  };
};

export const formatWatchGroup = (group, extras = {}) => ({
  id: group._id,
  shortCode: group.shortCode || "",
  name: group.name,
  type: group.type,
  maxParticipants: group.maxParticipants,
  owner: formatUser(group.owner),
  participantCount: extras.participantCount ?? 0,
  messageCount: extras.messageCount ?? 0,
  viewerRole: extras.viewerRole ?? null,
  isMember: extras.isMember ?? false,
  hasPendingInvite: extras.hasPendingInvite ?? false,
  inviteId: extras.inviteId ?? null,
  canJoin: extras.canJoin ?? false,
  canModerate: extras.canModerate ?? false,
  canDelete: extras.canDelete ?? false,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

export const formatWatchMessage = (message, extras = {}) => ({
  id: message._id,
  group: message.group?._id || message.group,
  text: message.text,
  author: formatUser(message.author),
  canDelete: extras.canDelete ?? false,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

export const formatParticipant = (membership) => {
  const user = membership.user;
  return {
    id: membership._id,
    role: membership.role,
    status: membership.status,
    joinedAt: membership.createdAt,
    user:
      user && typeof user === "object" && user._id
        ? formatUser(user)
        : { id: membership.user },
  };
};

export const findWatchGroupByParam = async (param) => {
  const id = await resolveDocumentId(WatchGroup, param);
  if (!id) return null;
  return WatchGroup.findById(id).populate("owner", "username name avatar");
};

const getMembership = async (groupId, userId) =>
  WatchGroupMember.findOne({
    group: groupId,
    user: userId,
    status: "active",
  });

const getPendingMembership = async (groupId, userId) =>
  WatchGroupMember.findOne({
    group: groupId,
    user: userId,
    status: "pending",
  });

const countSeatsTaken = async (groupId) =>
  WatchGroupMember.countDocuments({
    group: groupId,
    status: { $in: ["active", "pending"] },
  });

export const getViewerRole = async (group, user) => {
  if (!user) return null;
  if (hasWatchGroupsAdminPower(user)) return "admin";
  const membership = await getMembership(group._id, user._id);
  return membership?.role || null;
};

export const userCanModerateWatchGroup = async (group, user) => {
  const role = await getViewerRole(group, user);
  return role === "admin" || role === "owner" || role === "moderator";
};

export const userCanDeleteWatchGroup = async (group, user) => {
  if (!user) return false;
  if (hasWatchGroupsAdminPower(user)) return true;
  const role = await getViewerRole(group, user);
  return role === "owner";
};

export const userIsMember = async (group, user) => {
  if (!user) return false;
  if (hasWatchGroupsAdminPower(user)) return true;
  return Boolean(await getMembership(group._id, user._id));
};

export const userCanAccessWatchGroup = async (group, user) => {
  if (!user) return false;
  if (hasWatchGroupsAdminPower(user)) return true;
  if (group.type === "public") return true;
  if (await userIsMember(group, user)) return true;
  return Boolean(await getPendingMembership(group._id, user._id));
};

const countActiveParticipants = async (groupId) =>
  WatchGroupMember.countDocuments({ group: groupId, status: "active" });

const attachMeta = async (group, user) => {
  const participantCount = await countActiveParticipants(group._id);
  const membership = user ? await getMembership(group._id, user._id) : null;
  const pending = user
    ? await getPendingMembership(group._id, user._id)
    : null;
  const viewerRole = hasWatchGroupsAdminPower(user)
    ? "admin"
    : membership?.role || null;
  const isMember = Boolean(membership) || hasWatchGroupsAdminPower(user);
  const canModerate = await userCanModerateWatchGroup(group, user);
  const canDelete = await userCanDeleteWatchGroup(group, user);
  const atCapacity = (await countSeatsTaken(group._id)) >= group.maxParticipants;
  const canJoin =
    Boolean(user) &&
    !membership &&
    !pending &&
    !atCapacity &&
    (group.type === "public" || hasWatchGroupsAdminPower(user));

  return formatWatchGroup(group, {
    participantCount,
    viewerRole,
    isMember,
    hasPendingInvite: Boolean(pending),
    inviteId: pending ? String(pending._id) : null,
    canJoin,
    canModerate,
    canDelete,
  });
};

export const listWatchGroups = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = {};

    const memberships = await WatchGroupMember.find({
      user: req.user._id,
      status: { $in: ["active", "pending"] },
    }).select("group role status");

    const activeByGroup = new Map();
    const pendingByGroup = new Map();
    const memberGroupIds = [];
    for (const row of memberships) {
      const key = String(row.group);
      memberGroupIds.push(row.group);
      if (row.status === "active") activeByGroup.set(key, row);
      else if (row.status === "pending") pendingByGroup.set(key, row);
    }

    if (hasWatchGroupsAdminPower(req.user)) {
      // Watch Groups admins see all
    } else {
      filter.$or = [
        { type: "public" },
        { _id: { $in: memberGroupIds } },
      ];
    }

    const queryFilter = { ...filter };
    if (q) {
      queryFilter.name = {
        $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    const groups = await WatchGroup.find(queryFilter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("owner", "username name avatar");

    const groupIds = groups.map((g) => g._id);
    const [activeCounts, seatCounts] = await Promise.all([
      groupIds.length
        ? WatchGroupMember.aggregate([
            { $match: { group: { $in: groupIds }, status: "active" } },
            { $group: { _id: "$group", count: { $sum: 1 } } },
          ])
        : [],
      groupIds.length
        ? WatchGroupMember.aggregate([
            {
              $match: {
                group: { $in: groupIds },
                status: { $in: ["active", "pending"] },
              },
            },
            { $group: { _id: "$group", count: { $sum: 1 } } },
          ])
        : [],
    ]);

    const activeCountMap = new Map(
      activeCounts.map((row) => [String(row._id), row.count])
    );
    const seatCountMap = new Map(
      seatCounts.map((row) => [String(row._id), row.count])
    );

    const isAdmin = hasWatchGroupsAdminPower(req.user);
    const formatted = [];
    for (const group of groups) {
      const gid = String(group._id);
      const membership = activeByGroup.get(gid) || null;
      const pending = pendingByGroup.get(gid) || null;
      const canAccess =
        isAdmin ||
        group.type === "public" ||
        Boolean(membership) ||
        Boolean(pending);
      if (!canAccess) continue;

      const viewerRole = isAdmin ? "admin" : membership?.role || null;
      const isMember = Boolean(membership) || isAdmin;
      const canModerate =
        isAdmin || viewerRole === "owner" || viewerRole === "moderator";
      const canDelete = isAdmin || viewerRole === "owner";
      const participantCount = activeCountMap.get(gid) || 0;
      const seatsTaken = seatCountMap.get(gid) || 0;
      const atCapacity = seatsTaken >= group.maxParticipants;

      formatted.push(
        formatWatchGroup(group, {
          participantCount,
          viewerRole,
          isMember,
          hasPendingInvite: Boolean(pending),
          inviteId: pending ? String(pending._id) : null,
          canJoin:
            Boolean(req.user) &&
            !membership &&
            !pending &&
            !atCapacity &&
            (group.type === "public" || isAdmin),
          canModerate,
          canDelete,
        })
      );
    }

    return res.json({
      success: true,
      groups: formatted,
      limits: await getWatchGroupCreateLimits(),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list watch groups.");
  }
};

export const getWatchGroup = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanAccessWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this watch group.",
      });
    }

    return res.json({
      success: true,
      group: await attachMeta(group, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load watch group.");
  }
};

export const createWatchGroup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const type = String(req.body.type || "public")
      .toLowerCase()
      .trim();
    let maxParticipants = Number(req.body.maxParticipants);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
      });
    }

    if (await respondIfBanned(res, name)) return;
    if (!WATCH_GROUP_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be public or private.",
      });
    }

    const limits = await getWatchGroupCreateLimits();
    if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
      maxParticipants = limits.defaultValue;
    } else {
      maxParticipants = Math.floor(maxParticipants);
    }
    if (maxParticipants < limits.min || maxParticipants > limits.max) {
      return res.status(400).json({
        success: false,
        message: `Max participants must be between ${limits.min} and ${limits.max}.`,
      });
    }

    const group = await WatchGroup.create({
      name,
      type,
      maxParticipants,
      owner: req.user._id,
    });

    await WatchGroupMember.create({
      group: group._id,
      user: req.user._id,
      role: "owner",
      status: "active",
    });

    const populated = await WatchGroup.findById(group._id).populate(
      "owner",
      "username name avatar"
    );

    return res.status(201).json({
      success: true,
      message: "Watch group created.",
      group: await attachMeta(populated, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to create watch group.");
  }
};

export const joinWatchGroup = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (group.type === "private" && !hasWatchGroupsAdminPower(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Private groups require an invite from the owner or a moderator.",
      });
    }

    let membership = await WatchGroupMember.findOne({
      group: group._id,
      user: req.user._id,
    });

    if (membership?.status === "active") {
      return res.json({
        success: true,
        message: "Already a member.",
        group: await attachMeta(group, req.user),
      });
    }

    if (membership?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "You have a pending invite. Accept it to join this group.",
      });
    }

    const count = await countSeatsTaken(group._id);
    if (count >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    if (membership) {
      membership.status = "active";
      membership.role = membership.role === "owner" ? "owner" : "member";
      membership.removedAt = null;
      membership.removedBy = null;
      await membership.save();
    } else {
      await WatchGroupMember.create({
        group: group._id,
        user: req.user._id,
        role: "member",
        status: "active",
      });
    }

    const payload = await attachMeta(group, req.user);
    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_joined", {
      groupId: String(group._id),
      participantCount: payload.participantCount,
    });

    return res.json({
      success: true,
      message: "Joined watch group.",
      group: payload,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to join watch group.");
  }
};

export const leaveWatchGroup = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    const membership = await getMembership(group._id, req.user._id);
    if (!membership) {
      return res.status(400).json({
        success: false,
        message: "You are not a member of this group.",
      });
    }
    if (membership.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Owners cannot leave. Delete the group instead.",
      });
    }

    membership.status = "removed";
    membership.removedAt = new Date();
    membership.removedBy = req.user._id;
    await membership.save();

    const count = await countActiveParticipants(group._id);
    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_left", {
      groupId: String(group._id),
      userId: String(req.user._id),
      participantCount: count,
    });

    return res.json({ success: true, message: "Left watch group." });
  } catch (error) {
    return sendServerError(res, error, "Failed to leave watch group.");
  }
};

export const deleteWatchGroup = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanDeleteWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only the group owner can delete this watch group.",
      });
    }

    const groupId = String(group._id);
    await WatchGroupMessage.deleteMany({ group: group._id });
    await WatchGroupMember.deleteMany({ group: group._id });
    await group.deleteOne();

    req.app.get("io")?.to(`watch:${groupId}`).emit("watch_group_deleted", {
      groupId,
    });

    return res.json({ success: true, message: "Watch group deleted." });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete watch group.");
  }
};

export const listParticipants = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userIsMember(group, req.user))) {
      // Public groups: allow join-preview roster; private needs membership / tab power.
      if (!(await userCanAccessWatchGroup(group, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this watch group.",
        });
      }
    }

    const canModerate = await userCanModerateWatchGroup(group, req.user);
    const statusFilter = canModerate
      ? { $in: ["active", "pending"] }
      : "active";

    const members = await WatchGroupMember.find({
      group: group._id,
      status: statusFilter,
    })
      .populate("user", "username name avatar")
      .sort({ status: 1, role: 1, createdAt: 1 });

    return res.json({
      success: true,
      participants: members.map(formatParticipant),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list participants.");
  }
};

export const removeParticipant = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanModerateWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only owners and moderators can remove participants.",
      });
    }

    const membership = await WatchGroupMember.findOne({
      _id: req.params.memberId,
      group: group._id,
      status: { $in: ["active", "pending"] },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Participant not found.",
      });
    }

    if (membership.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Cannot remove the group owner.",
      });
    }

    const wasPending = membership.status === "pending";
    const actorRole = await getViewerRole(group, req.user);
    if (
      !wasPending &&
      membership.role === "moderator" &&
      actorRole === "moderator" &&
      !hasWatchGroupsAdminPower(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Moderators cannot remove other moderators.",
      });
    }

    membership.status = "removed";
    membership.removedAt = new Date();
    membership.removedBy = req.user._id;
    await membership.save();

    const userId = String(membership.user);
    const count = await countActiveParticipants(group._id);

    if (!wasPending) {
      req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_removed", {
        groupId: String(group._id),
        userId,
        memberId: String(membership._id),
        participantCount: count,
      });
    }

    return res.json({
      success: true,
      message: wasPending ? "Invite cancelled." : "Participant removed.",
      memberId: String(membership._id),
      userId,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to remove participant.");
  }
};

export const addParticipant = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanModerateWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only owners and moderators can invite participants.",
      });
    }

    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();
    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const user = await User.findOne({
      username: new RegExp(
        `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself.",
      });
    }

    const seatsTaken = await countSeatsTaken(group._id);
    let membership = await WatchGroupMember.findOne({
      group: group._id,
      user: user._id,
    });

    if (membership?.status === "active") {
      return res.status(400).json({
        success: false,
        message: "User is already a participant.",
      });
    }

    if (membership?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "An invite is already pending for this user.",
      });
    }

    if (!membership && seatsTaken >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    if (membership) {
      membership.status = "pending";
      membership.role = "member";
      membership.removedAt = null;
      membership.removedBy = null;
      await membership.save();
    } else {
      membership = await WatchGroupMember.create({
        group: group._id,
        user: user._id,
        role: "member",
        status: "pending",
      });
    }

    await membership.populate("user", "username name avatar");

    await notify({
      io: req.app.get("io"),
      recipientId: user._id,
      actor: req.user,
      type: "watch_group_invite",
      title: `${personName(req.user)} invited you to ${group.name}`,
      body: "Accept the invite to join this watch group chat.",
      entity: {
        kind: "watch_group",
        _id: group._id,
        id: group._id,
        shortCode: group.shortCode || "",
        name: group.name,
        title: group.name,
      },
      collapse: true,
    });

    return res.status(201).json({
      success: true,
      message: "Invite sent.",
      participant: formatParticipant(membership),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to invite participant.");
  }
};

export const listMyWatchInvites = async (req, res) => {
  try {
    const invites = await WatchGroupMember.find({
      user: req.user._id,
      status: "pending",
    })
      .populate({
        path: "group",
        populate: { path: "owner", select: "username name avatar" },
      })
      .sort({ updatedAt: -1 })
      .limit(50);

    const formatted = [];
    for (const invite of invites) {
      if (!invite.group) continue;
      const meta = await attachMeta(invite.group, req.user);
      formatted.push({
        inviteId: String(invite._id),
        invitedAt: invite.updatedAt || invite.createdAt,
        group: meta,
      });
    }

    return res.json({ success: true, invites: formatted });
  } catch (error) {
    return sendServerError(res, error, "Failed to list watch group invites.");
  }
};

export const acceptWatchInvite = async (req, res) => {
  try {
    if (!isValidMemberId(req.params.memberId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invite.",
      });
    }

    const membership = await WatchGroupMember.findOne({
      _id: req.params.memberId,
      user: req.user._id,
      status: "pending",
    }).populate({
      path: "group",
      populate: { path: "owner", select: "username name avatar" },
    });

    if (!membership?.group) {
      return res.status(404).json({
        success: false,
        message: "Invite not found.",
      });
    }

    const group = membership.group;
    const activeCount = await countActiveParticipants(group._id);
    if (activeCount >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    membership.status = "active";
    membership.removedAt = null;
    membership.removedBy = null;
    await membership.save();

    const newCount = await countActiveParticipants(group._id);
    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_joined", {
      groupId: String(group._id),
      participantCount: newCount,
    });

    return res.json({
      success: true,
      message: "Invite accepted.",
      group: await attachMeta(group, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to accept invite.");
  }
};

export const declineWatchInvite = async (req, res) => {
  try {
    if (!isValidMemberId(req.params.memberId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invite.",
      });
    }

    const membership = await WatchGroupMember.findOne({
      _id: req.params.memberId,
      user: req.user._id,
      status: "pending",
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Invite not found.",
      });
    }

    membership.status = "removed";
    membership.removedAt = new Date();
    membership.removedBy = req.user._id;
    await membership.save();

    return res.json({
      success: true,
      message: "Invite declined.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to decline invite.");
  }
};

export const setParticipantRole = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanDeleteWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only the group owner can change roles.",
      });
    }

    const role = String(req.body.role || "")
      .toLowerCase()
      .trim();
    if (role !== "moderator" && role !== "member") {
      return res.status(400).json({
        success: false,
        message: "Role must be moderator or member.",
      });
    }

    const membership = await WatchGroupMember.findOne({
      _id: req.params.memberId,
      group: group._id,
      status: "active",
    }).populate("user", "username name avatar");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Participant not found.",
      });
    }
    if (membership.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Cannot change the owner role.",
      });
    }

    membership.role = role;
    await membership.save();

    return res.json({
      success: true,
      message: `Participant is now a ${role}.`,
      participant: formatParticipant(membership),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update role.");
  }
};

export const listWatchMessages = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userIsMember(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Join the watch group to view chat.",
      });
    }

    const canModerate = await userCanModerateWatchGroup(group, req.user);
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const messages = await WatchGroupMessage.find({ group: group._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "username name avatar");

    return res.json({
      success: true,
      messages: messages
        .reverse()
        .map((m) => formatWatchMessage(m, { canDelete: canModerate })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load messages.");
  }
};

export const deleteWatchMessage = async (req, res) => {
  try {
    const group = await findWatchGroupByParam(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Watch group not found.",
      });
    }

    if (!(await userCanModerateWatchGroup(group, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only owners and moderators can remove messages.",
      });
    }

    const message = await WatchGroupMessage.findOne({
      _id: req.params.messageId,
      group: group._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    const messageId = String(message._id);
    await message.deleteOne();

    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_message_deleted", {
      groupId: String(group._id),
      messageId,
    });

    return res.json({
      success: true,
      message: "Message removed.",
      messageId,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete message.");
  }
};

/** Admin overview list with message + participant counts. */
export const adminListWatchGroups = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "all").toLowerCase();

    const filter = {};
    if (type === "public" || type === "private") {
      filter.type = type;
    }

    const groups = await WatchGroup.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("owner", "username name avatar");

    const ids = groups.map((g) => g._id);
    const [memberCounts, messageCounts] = await Promise.all([
      WatchGroupMember.aggregate([
        { $match: { group: { $in: ids }, status: "active" } },
        { $group: { _id: "$group", count: { $sum: 1 } } },
      ]),
      WatchGroupMessage.aggregate([
        { $match: { group: { $in: ids } } },
        { $group: { _id: "$group", count: { $sum: 1 } } },
      ]),
    ]);

    const memberMap = Object.fromEntries(
      memberCounts.map((r) => [String(r._id), r.count])
    );
    const messageMap = Object.fromEntries(
      messageCounts.map((r) => [String(r._id), r.count])
    );

    let formatted = groups.map((group) =>
      formatWatchGroup(group, {
        participantCount: memberMap[String(group._id)] || 0,
        messageCount: messageMap[String(group._id)] || 0,
        canModerate: true,
        canDelete: true,
        isMember: false,
        canJoin: false,
        viewerRole: "admin",
      })
    );

    if (q) {
      const needle = q.toLowerCase();
      formatted = formatted.filter((g) => {
        const hay = [
          g.name,
          g.type,
          g.owner?.name,
          g.owner?.username,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    return res.json({
      success: true,
      groups: formatted,
      summary: {
        all: formatted.length,
        public: formatted.filter((g) => g.type === "public").length,
        private: formatted.filter((g) => g.type === "private").length,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list watch groups.");
  }
};
