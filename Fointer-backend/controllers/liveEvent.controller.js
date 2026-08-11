import Community from "../models/community.js";
import LiveEvent, {
  LIVE_EVENT_CATEGORIES,
  LIVE_EVENT_ACCESS,
} from "../models/liveEvent.js";
import LiveEventMember from "../models/liveEventMember.js";
import CommunityMember from "../models/communityMember.js";
import {
  canEngageInCommunity,
  canModerateCommunity,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { getIo } from "../sockets/initSocket.js";
import {
  LIVE_EVENT_SOCKET_EVENTS,
  toLiveEventRoom,
} from "../sockets/events.js";

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

export const formatLiveEvent = (event, extras = {}) => {
  const participantCount =
    extras.participantCount != null
      ? extras.participantCount
      : Array.isArray(event.participantCount)
        ? event.participantCount[0]?.count
        : undefined;

  return {
    id: event._id,
    shortCode: event.shortCode || null,
    title: event.title,
    category: event.category,
    access: event.access,
    status: event.status,
    community: formatCommunityBrief(event.community),
    createdBy: formatUser(event.createdBy),
    participantCount:
      participantCount != null
        ? Number(participantCount)
        : extras.participantCount ?? 1,
    myRole: extras.myRole || null,
    canManage: Boolean(extras.canManage),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
};

const resolveCommunity = async (value) => {
  const id = await resolveDocumentId(Community, value);
  if (!id) return null;
  return Community.findById(id);
};

const resolveLiveEvent = async (value) => {
  const id = await resolveDocumentId(LiveEvent, value);
  if (!id) return null;
  return LiveEvent.findById(id)
    .populate("community", "name shortCode")
    .populate("createdBy", "username name avatar");
};

const getActiveParticipantCount = async (liveEventId) =>
  LiveEventMember.countDocuments({
    liveEvent: liveEventId,
    status: "active",
  });

const OPEN_LIVE_EVENT_STATUSES = ["active"];

const isOpenLiveEvent = (event) =>
  Boolean(event && OPEN_LIVE_EVENT_STATUSES.includes(event.status));

const getEventCommunityRef = (event) => {
  if (!event?.community) return null;
  if (event.community._id) return event.community;
  return { _id: event.community };
};

const canManageLiveEvent = async (event, user) => {
  if (!event) {
    return { ok: false, code: 404, message: "Live event not found." };
  }
  const community = getEventCommunityRef(event);
  if (!community?._id) {
    return {
      ok: false,
      code: 403,
      message: "You do not have permission to manage this live event.",
    };
  }
  const canModerate = await canModerateCommunity(community, user);
  if (!canModerate) {
    return {
      ok: false,
      code: 403,
      message:
        "Only community owners or moderators can manage this live event.",
    };
  }
  return { ok: true };
};

const upsertActiveMember = async (liveEventId, userId, role = "member") => {
  const existing = await LiveEventMember.findOne({
    liveEvent: liveEventId,
    user: userId,
  });

  if (existing) {
    existing.status = "active";
    if (role === "owner") existing.role = "owner";
    else if (!existing.role) existing.role = "member";
    await existing.save();
    return existing;
  }

  return LiveEventMember.create({
    liveEvent: liveEventId,
    user: userId,
    role,
    status: "active",
  });
};

const emitEventStatus = (eventId, payload) => {
  try {
    const io = getIo();
    if (!io) return;
    io.to(toLiveEventRoom(String(eventId))).emit(
      LIVE_EVENT_SOCKET_EVENTS.EVENT_STATUS_UPDATED,
      payload
    );
  } catch {
    // Socket optional
  }
};

/**
 * Create a live event. Community is required; only owner/moderator can start.
 */
export const createLiveEvent = async (req, res) => {
  try {
    const {
      title,
      category,
      access,
      communityId,
      community: communityInput,
    } = req.body;

    const communityRef = communityId || communityInput;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Event title is required.",
      });
    }

    if (!communityRef) {
      return res.status(400).json({
        success: false,
        message: "Community is required.",
      });
    }

    const community = await resolveCommunity(communityRef);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    const canCreate = await canModerateCommunity(community, req.user);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message:
          "Only community owners or moderators can start a live event.",
      });
    }

    const eventCategory = category || "custom";
    if (!LIVE_EVENT_CATEGORIES.includes(eventCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed: ${LIVE_EVENT_CATEGORIES.join(", ")}.`,
      });
    }

    const eventAccess = access || "community_restricted";
    if (!LIVE_EVENT_ACCESS.includes(eventAccess)) {
      return res.status(400).json({
        success: false,
        message: `Invalid access. Allowed: ${LIVE_EVENT_ACCESS.join(", ")}.`,
      });
    }

    const event = await LiveEvent.create({
      title: String(title).trim(),
      category: eventCategory,
      access: eventAccess,
      community: community._id,
      createdBy: req.user._id,
      status: "active",
    });

    await LiveEventMember.create({
      liveEvent: event._id,
      user: req.user._id,
      role: "owner",
      status: "active",
    });

    const populated = await LiveEvent.findById(event._id)
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Live event started successfully.",
      liveEvent: formatLiveEvent(populated, {
        participantCount: 1,
        myRole: "owner",
        canManage: true,
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
 * List live events visible to the current user.
 */
export const listLiveEvents = async (req, res) => {
  try {
    const communityRef = req.query.communityId || req.query.community;
    const filter = { status: { $in: OPEN_LIVE_EVENT_STATUSES } };

    if (communityRef) {
      const community = await resolveCommunity(communityRef);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found.",
        });
      }

      const canView = await canEngageInCommunity(community._id, req.user);
      const isModerator = await canModerateCommunity(community, req.user);
      if (!canView && !isModerator && req.user.role !== "admin") {
        // Public events in this community are still listable for logged-in users
        filter.community = community._id;
        filter.access = "public";
      } else {
        filter.community = community._id;
      }
    } else {
      const [communityMemberships, eventMemberships] = await Promise.all([
        CommunityMember.find({
          user: req.user._id,
          status: "active",
        })
          .select("community")
          .lean(),
        LiveEventMember.find({
          user: req.user._id,
          status: "active",
        })
          .select("liveEvent")
          .lean(),
      ]);

      const communityIds = communityMemberships.map((m) => m.community);
      const memberEventIds = eventMemberships.map((m) => m.liveEvent);

      const or = [{ access: "public" }];
      if (communityIds.length) {
        or.push({ community: { $in: communityIds } });
      }
      if (memberEventIds.length) {
        or.push({ _id: { $in: memberEventIds } });
      }
      filter.$or = or;
    }

    const events = await LiveEvent.find(filter)
      .sort({ createdAt: -1 })
      .populate("community", "name shortCode")
      .populate("createdBy", "username name avatar")
      .lean();

    const eventIds = events.map((e) => e._id);
    const [counts, myMemberships] = await Promise.all([
      LiveEventMember.aggregate([
        { $match: { liveEvent: { $in: eventIds }, status: "active" } },
        { $group: { _id: "$liveEvent", count: { $sum: 1 } } },
      ]),
      LiveEventMember.find({
        liveEvent: { $in: eventIds },
        user: req.user._id,
        status: "active",
      })
        .select("liveEvent role")
        .lean(),
    ]);

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const roleMap = new Map(
      myMemberships.map((m) => [String(m.liveEvent), m.role])
    );

    const communityIds = [
      ...new Set(
        events
          .map((e) => String(e.community?._id || e.community || ""))
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
      liveEvents: events.map((e) => {
        const id = String(e._id);
        const myRole = roleMap.get(id) || null;
        const communityId = String(e.community?._id || e.community || "");
        const canManage = moderateCommunityIds.has(communityId);
        return formatLiveEvent(e, {
          participantCount: countMap.get(id) || 0,
          myRole,
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
 * Communities the user can start a live event in (owner/moderator only).
 */
export const getLiveEventCreateContext = async (req, res) => {
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
        if (
          !role ||
          !row.community ||
          (role !== "owner" &&
            role !== "moderator" &&
            req.user.role !== "admin")
        ) {
          return null;
        }
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

    // Platform admins without memberships: still allow empty list;
    // they can be added later if needed.
    if (req.user.role === "admin" && !communities.length) {
      // no-op: keep empty unless we want all communities
    }

    return res.status(200).json({
      success: true,
      communities,
      defaults: {
        category: "custom",
        access: "community_restricted",
      },
      categories: LIVE_EVENT_CATEGORIES,
      accessOptions: LIVE_EVENT_ACCESS,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Join a live event (public = any logged-in user; community_restricted = members).
 */
export const joinLiveEvent = async (req, res) => {
  try {
    const event = await resolveLiveEvent(req.params.eventId);
    if (!isOpenLiveEvent(event)) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    if (event.access === "community_restricted") {
      const communityId = event.community._id || event.community;
      const canEngage = await canEngageInCommunity(communityId, req.user);
      if (!canEngage) {
        return res.status(403).json({
          success: false,
          message: "Only community members can join this live event.",
        });
      }
    }

    const existing = await LiveEventMember.findOne({
      liveEvent: event._id,
      user: req.user._id,
      status: "active",
    }).lean();

    if (existing) {
      const participantCount = await getActiveParticipantCount(event._id);
      const manageCheck = await canManageLiveEvent(event, req.user);
      return res.status(200).json({
        success: true,
        message: "Already joined this live event.",
        liveEvent: formatLiveEvent(event.toObject ? event.toObject() : event, {
          participantCount,
          myRole: existing.role,
          canManage: manageCheck.ok,
        }),
      });
    }

    const membership = await upsertActiveMember(event._id, req.user._id);
    const participantCount = await getActiveParticipantCount(event._id);
    const lean = event.toObject ? event.toObject() : event;
    const manageCheck = await canManageLiveEvent(event, req.user);

    return res.status(200).json({
      success: true,
      message: "Joined live event successfully.",
      liveEvent: formatLiveEvent(lean, {
        participantCount,
        myRole: membership.role,
        canManage: manageCheck.ok,
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
 * End a live event (owner/moderator). Sets status to "ended".
 */
export const endLiveEvent = async (req, res) => {
  try {
    const event = await resolveLiveEvent(req.params.eventId);
    if (!isOpenLiveEvent(event)) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    const manageCheck = await canManageLiveEvent(event, req.user);
    if (!manageCheck.ok) {
      return res.status(manageCheck.code).json({
        success: false,
        message: manageCheck.message,
      });
    }

    event.status = "ended";
    await event.save();

    const lean = event.toObject ? event.toObject() : event;
    const payload = {
      eventId: String(event._id),
      status: event.status,
      liveEvent: formatLiveEvent(lean, { canManage: true }),
    };
    emitEventStatus(event._id, payload);

    return res.status(200).json({
      success: true,
      message: "Live event ended.",
      liveEvent: formatLiveEvent(lean, { canManage: true }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Soft-delete a live event (owner/moderator). Sets status to "closed".
 */
export const closeLiveEvent = async (req, res) => {
  try {
    const event = await resolveLiveEvent(req.params.eventId);
    if (!event || !["active", "ended"].includes(event.status)) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    const manageCheck = await canManageLiveEvent(event, req.user);
    if (!manageCheck.ok) {
      return res.status(manageCheck.code).json({
        success: false,
        message: manageCheck.message,
      });
    }

    event.status = "closed";
    await event.save();

    const lean = event.toObject ? event.toObject() : event;
    const payload = {
      eventId: String(event._id),
      status: event.status,
      liveEvent: formatLiveEvent(lean, { canManage: true }),
    };
    emitEventStatus(event._id, payload);

    return res.status(200).json({
      success: true,
      message: "Live event deleted.",
      liveEvent: formatLiveEvent(lean, { canManage: true }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove a member from a live event (owner/moderator).
 */
export const removeLiveEventMember = async (req, res) => {
  try {
    const event = await resolveLiveEvent(req.params.eventId);
    if (!isOpenLiveEvent(event)) {
      return res.status(404).json({
        success: false,
        message: "Live event not found.",
      });
    }

    const manageCheck = await canManageLiveEvent(event, req.user);
    if (!manageCheck.ok) {
      return res.status(manageCheck.code).json({
        success: false,
        message: manageCheck.message,
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
        message: "You cannot remove yourself from the event.",
      });
    }

    const membership = await LiveEventMember.findOne({
      liveEvent: event._id,
      user: targetUserId,
    });

    if (!membership || membership.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Member not found in this live event.",
      });
    }

    membership.status = "removed";
    await membership.save();

    return res.status(200).json({
      success: true,
      message: "Member removed from live event.",
      userId: targetUserId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
