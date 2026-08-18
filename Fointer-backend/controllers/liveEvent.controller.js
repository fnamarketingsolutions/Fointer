import LiveEvent, {
  LIVE_EVENT_ACCESS,
  LIVE_EVENT_CATEGORIES,
} from "../models/liveEvent.js";
import LiveMessage from "../models/liveMessage.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import {
  canManageCommunity,
  canModerateCommunity,
  canEngageInCommunity,
  getActorCommunityRole,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";
import { parseObjectIdInput, resolveDocumentId } from "../utils/shortCode.js";
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

const formatCommunity = (community) => {
  if (!community || typeof community !== "object" || !community._id) {
    return community ? { id: community } : null;
  }
  return {
    id: community._id,
    shortCode: community.shortCode || "",
    name: community.name,
    coverImage: community.coverImage || "",
  };
};

export const formatLiveEvent = (event, extras = {}) => ({
  id: event._id,
  shortCode: event.shortCode || "",
  title: event.title,
  category: event.category,
  customCategory: event.customCategory || "",
  access: event.access,
  status: event.status,
  community: formatCommunity(event.community),
  host: formatUser(event.host),
  viewerCount: extras.viewerCount ?? 0,
  messageCount: extras.messageCount ?? 0,
  canModerate: extras.canModerate ?? false,
  canEnd: extras.canEnd ?? false,
  canDelete: extras.canDelete ?? false,
  endedAt: event.endedAt || null,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

export const formatLiveMessage = (message, extras = {}) => ({
  id: message._id,
  event: message.event?._id || message.event,
  text: message.text,
  author: formatUser(message.author),
  canDelete: extras.canDelete ?? false,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

export const findLiveEventByParam = async (param) => {
  const id = await resolveDocumentId(LiveEvent, param);
  if (!id) return null;
  return LiveEvent.findById(id)
    .populate("community", "name shortCode coverImage owner type")
    .populate("host", "username name avatar");
};

export const userCanAccessLiveEvent = async (event, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (event.access === "public") return true;

  const communityId = event.community?._id || event.community;
  return canEngageInCommunity(communityId, user);
};

export const userCanModerateLiveEvent = async (event, user) => {
  if (!user) return false;
  const community = event.community;
  if (!community) return false;
  return canModerateCommunity(community, user);
};

export const userCanEndOrDeleteLiveEvent = async (event, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;

  const community = event.community;
  if (community && canManageCommunity(community, user)) return true;
  if (community && (await canModerateCommunity(community, user))) return true;

  const hostId = event.host?._id || event.host;
  return Boolean(hostId && String(hostId) === String(user._id));
};

const attachPermissions = async (event, user, viewerCount = 0) => {
  const canModerate = await userCanModerateLiveEvent(event, user);
  const canEnd = await userCanEndOrDeleteLiveEvent(event, user);
  return formatLiveEvent(event, {
    viewerCount,
    canModerate,
    canEnd,
    canDelete: canEnd,
  });
};

export const listLiveEvents = async (req, res) => {
  try {
    const status = String(req.query.status || "live").toLowerCase();
    const rawCommunityId = req.query.communityId;

    const filter = {};
    if (status === "live" || status === "ended") {
      filter.status = status;
    } else if (status !== "all") {
      filter.status = "live";
    }
    if (
      rawCommunityId !== undefined &&
      rawCommunityId !== null &&
      rawCommunityId !== ""
    ) {
      const communityId = parseObjectIdInput(rawCommunityId);
      if (!communityId) {
        return res.status(400).json({
          success: false,
          message: "Invalid community id.",
        });
      }
      filter.community = communityId;
    }

    const events = await LiveEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("community", "name shortCode coverImage owner type")
      .populate("host", "username name avatar");

    const accessible = [];
    for (const event of events) {
      if (await userCanAccessLiveEvent(event, req.user)) {
        accessible.push(await attachPermissions(event, req.user));
      }
    }

    return res.json({
      success: true,
      events: accessible,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list live events.");
  }
};

export const getLiveEvent = async (req, res) => {
  try {
    const event = await findLiveEventByParam(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (!(await userCanAccessLiveEvent(event, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this live event.",
      });
    }

    return res.json({
      success: true,
      event: await attachPermissions(event, req.user),
      viewerRole: await getActorCommunityRole(
        event.community?._id || event.community,
        req.user
      ),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load live event.");
  }
};

export const createLiveEvent = async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const category = String(req.body.category || "")
      .toLowerCase()
      .trim();
    const customCategory = String(req.body.customCategory || "").trim();
    const access = String(req.body.access || "community")
      .toLowerCase()
      .trim();
    const communityId = req.body.communityId;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Event title is required.",
      });
    }
    if (!LIVE_EVENT_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Category must be Sports, Entertainment, News, or Custom.",
      });
    }
    if (category === "custom" && !customCategory) {
      return res.status(400).json({
        success: false,
        message: "Please provide a custom category name.",
      });
    }
    if (!LIVE_EVENT_ACCESS.includes(access)) {
      return res.status(400).json({
        success: false,
        message: "Access must be public or community.",
      });
    }
    if (!communityId) {
      return res.status(400).json({
        success: false,
        message: "Community is required.",
      });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    const canStart = await canModerateCommunity(community, req.user);
    if (!canStart) {
      return res.status(403).json({
        success: false,
        message: "Only owners and moderators can start live commentary.",
      });
    }

    const event = await LiveEvent.create({
      title,
      category,
      customCategory: category === "custom" ? customCategory : "",
      access: access === "public" ? "public" : "community",
      community: community._id,
      host: req.user._id,
      status: "live",
    });

    const populated = await LiveEvent.findById(event._id)
      .populate("community", "name shortCode coverImage owner type")
      .populate("host", "username name avatar");

    return res.status(201).json({
      success: true,
      message: "Live commentary started.",
      event: await attachPermissions(populated, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to start live event.");
  }
};

export const endLiveEvent = async (req, res) => {
  try {
    const event = await findLiveEventByParam(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (!(await userCanEndOrDeleteLiveEvent(event, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only the community owner, moderators, or the host can end this event.",
      });
    }

    if (event.status === "ended") {
      return res.json({
        success: true,
        message: "Event already ended.",
        event: await attachPermissions(event, req.user),
      });
    }

    event.status = "ended";
    event.endedAt = new Date();
    await event.save();

    const payload = await attachPermissions(event, req.user);
    req.app.get("io")?.to(`live:${event._id}`).emit("event_ended", {
      eventId: String(event._id),
      event: payload,
    });

    return res.json({
      success: true,
      message: "Live event ended.",
      event: payload,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to end live event.");
  }
};

export const deleteLiveEvent = async (req, res) => {
  try {
    const event = await findLiveEventByParam(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (!(await userCanEndOrDeleteLiveEvent(event, req.user))) {
      return res.status(403).json({
        success: false,
        message:
          "Only the community owner, moderators, or the host can delete this event.",
      });
    }

    const eventId = String(event._id);
    await LiveMessage.deleteMany({ event: event._id });
    await event.deleteOne();

    req.app.get("io")?.to(`live:${eventId}`).emit("event_deleted", {
      eventId,
    });

    return res.json({
      success: true,
      message: "Live event deleted.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete live event.");
  }
};

export const listLiveMessages = async (req, res) => {
  try {
    const event = await findLiveEventByParam(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (!(await userCanAccessLiveEvent(event, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this live event.",
      });
    }

    const canModerate = await userCanModerateLiveEvent(event, req.user);
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const messages = await LiveMessage.find({ event: event._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "username name avatar");

    return res.json({
      success: true,
      messages: messages
        .reverse()
        .map((m) => formatLiveMessage(m, { canDelete: canModerate })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load messages.");
  }
};

export const deleteLiveMessage = async (req, res) => {
  try {
    const event = await findLiveEventByParam(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (!(await userCanModerateLiveEvent(event, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only moderators and owners can remove messages.",
      });
    }

    const message = await LiveMessage.findOne({
      _id: req.params.messageId,
      event: event._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    const messageId = String(message._id);
    await message.deleteOne();

    req.app.get("io")?.to(`live:${event._id}`).emit("message_deleted", {
      eventId: String(event._id),
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

/** Communities where the user can start live commentary (owner/moderator). */
export const listHostableCommunities = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const communities = await Community.find()
        .select("name shortCode coverImage")
        .sort({ name: 1 })
        .limit(200);
      return res.json({
        success: true,
        communities: communities.map((c) => ({
          id: c._id,
          name: c.name,
          shortCode: c.shortCode || "",
          coverImage: c.coverImage || "",
          role: "admin",
        })),
      });
    }

    const memberships = await CommunityMember.find({
      user: req.user._id,
      status: "active",
      role: { $in: ["owner", "moderator"] },
    }).populate("community", "name shortCode coverImage");

    const communities = [];
    for (const m of memberships) {
      const role = getEffectiveMemberRole(m);
      if (role !== "owner" && role !== "moderator") continue;
      if (!m.community) continue;
      communities.push({
        id: m.community._id,
        name: m.community.name,
        shortCode: m.community.shortCode || "",
        coverImage: m.community.coverImage || "",
        role,
      });
    }

    return res.json({ success: true, communities });
  } catch (error) {
    return sendServerError(res, error, "Failed to load communities.");
  }
};

/** Admin: list every live event with message counts (no access filter). */
export const adminListLiveEvents = async (req, res) => {
  try {
    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();

    const filter = {};
    if (status === "live" || status === "ended") {
      filter.status = status;
    }

    const events = await LiveEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("community", "name shortCode coverImage owner type")
      .populate("host", "username name avatar");

    const eventIds = events.map((e) => e._id);
    const counts = await LiveMessage.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const row of counts) {
      countMap[String(row._id)] = row.count;
    }

    let formatted = events.map((event) =>
      formatLiveEvent(event, {
        messageCount: countMap[String(event._id)] || 0,
        canModerate: true,
        canEnd: true,
        canDelete: true,
      })
    );

    if (q) {
      const needle = q.toLowerCase();
      formatted = formatted.filter((event) => {
        const hay = [
          event.title,
          event.category,
          event.customCategory,
          event.community?.name,
          event.host?.name,
          event.host?.username,
          event.access,
          event.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    const summary = {
      all: formatted.length,
      live: formatted.filter((e) => e.status === "live").length,
      ended: formatted.filter((e) => e.status === "ended").length,
    };

    return res.json({
      success: true,
      events: formatted,
      summary,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list live events.");
  }
};