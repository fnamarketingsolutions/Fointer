import WatchGroup, {
  WATCH_GROUP_TYPES,
  WATCH_GROUP_DEFAULT_MAX,
  WATCH_GROUP_ABSOLUTE_MAX,
} from "../models/watchGroup.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import WatchGroupMessage from "../models/watchGroupMessage.js";
import User from "../models/user.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";

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

export const getViewerRole = async (group, user) => {
  if (!user) return null;
  if (user.role === "admin") return "admin";
  const membership = await getMembership(group._id, user._id);
  return membership?.role || null;
};

export const userCanModerateWatchGroup = async (group, user) => {
  const role = await getViewerRole(group, user);
  return role === "admin" || role === "owner" || role === "moderator";
};

export const userCanDeleteWatchGroup = async (group, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  const role = await getViewerRole(group, user);
  return role === "owner";
};

export const userIsMember = async (group, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(await getMembership(group._id, user._id));
};

export const userCanAccessWatchGroup = async (group, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (group.type === "public") return true;
  return userIsMember(group, user);
};

const countActiveParticipants = async (groupId) =>
  WatchGroupMember.countDocuments({ group: groupId, status: "active" });

const attachMeta = async (group, user) => {
  const participantCount = await countActiveParticipants(group._id);
  const membership = user ? await getMembership(group._id, user._id) : null;
  const viewerRole =
    user?.role === "admin"
      ? "admin"
      : membership?.role || null;
  const isMember = Boolean(membership) || user?.role === "admin";
  const canModerate = await userCanModerateWatchGroup(group, user);
  const canDelete = await userCanDeleteWatchGroup(group, user);
  const atCapacity = participantCount >= group.maxParticipants;
  const canJoin =
    Boolean(user) &&
    !membership &&
    !atCapacity &&
    (group.type === "public" || user.role === "admin");

  return formatWatchGroup(group, {
    participantCount,
    viewerRole,
    isMember,
    canJoin,
    canModerate,
    canDelete,
  });
};

export const listWatchGroups = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = {};

    // Public groups + private groups the user belongs to
    const memberships = await WatchGroupMember.find({
      user: req.user._id,
      status: "active",
    }).select("group");
    const memberGroupIds = memberships.map((m) => m.group);

    if (req.user.role === "admin") {
      // admins see all
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

    const formatted = [];
    for (const group of groups) {
      if (await userCanAccessWatchGroup(group, req.user)) {
        formatted.push(await attachMeta(group, req.user));
      }
    }

    return res.json({ success: true, groups: formatted });
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
    if (!WATCH_GROUP_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be public or private.",
      });
    }
    if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
      maxParticipants = WATCH_GROUP_DEFAULT_MAX;
    }
    maxParticipants = Math.min(
      WATCH_GROUP_ABSOLUTE_MAX,
      Math.max(2, Math.floor(maxParticipants))
    );

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

    if (group.type === "private" && req.user.role !== "admin") {
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

    const count = await countActiveParticipants(group._id);
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

    if (!(await userIsMember(group, req.user)) && req.user.role !== "admin") {
      // Public groups: members-only for participant list once joined;
      // allow access if user can see the group (public) for join preview
      if (!(await userCanAccessWatchGroup(group, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this watch group.",
        });
      }
    }

    const members = await WatchGroupMember.find({
      group: group._id,
      status: "active",
    })
      .populate("user", "username name avatar")
      .sort({ role: 1, createdAt: 1 });

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
      status: "active",
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

    const actorRole = await getViewerRole(group, req.user);
    if (
      membership.role === "moderator" &&
      actorRole === "moderator" &&
      req.user.role !== "admin"
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

    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_removed", {
      groupId: String(group._id),
      userId,
      memberId: String(membership._id),
      participantCount: count,
    });

    return res.json({
      success: true,
      message: "Participant removed.",
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
        message: "Only owners and moderators can add participants.",
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
      username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const count = await countActiveParticipants(group._id);
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

    if (!membership && count >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This watch group is full.",
      });
    }

    if (membership) {
      membership.status = "active";
      membership.role = "member";
      membership.removedAt = null;
      membership.removedBy = null;
      await membership.save();
    } else {
      membership = await WatchGroupMember.create({
        group: group._id,
        user: user._id,
        role: "member",
        status: "active",
      });
    }

    await membership.populate("user", "username name avatar");
    const newCount = await countActiveParticipants(group._id);

    req.app.get("io")?.to(`watch:${group._id}`).emit("watch_participant_joined", {
      groupId: String(group._id),
      participantCount: newCount,
    });

    return res.status(201).json({
      success: true,
      message: "Participant added.",
      participant: formatParticipant(membership),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to add participant.");
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

    if (!(await userIsMember(group, req.user)) && req.user.role !== "admin") {
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
