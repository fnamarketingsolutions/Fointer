import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Notification, {
  ADMIN_NOTIFICATION_TYPES,
} from "../models/notification.js";
import User from "../models/user.js";
import { getEffectiveMemberRole } from "./communityPermissions.js";

const ADMIN_TYPE_SET = new Set(ADMIN_NOTIFICATION_TYPES);
const ADMIN_ID_CACHE_MS = 15_000;
let adminIdCache = { ids: [], at: 0 };

export const userNotificationRoom = (userId) => `user:${String(userId)}`;

export const personName = (user) => {
  const name = String(user?.name || user?.username || "").trim();
  return name || "Someone";
};

export const snippet = (text, max = 140) => {
  const value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.id || null;
  return value;
};

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  return String(toId(a)) === String(toId(b));
};

export const snapshotUser = (user) => {
  if (!user) return null;
  const id = toId(user);
  if (!id) return null;
  if (typeof user === "object") {
    return {
      userId: id,
      username: user.username || "",
      name: user.name || "",
      avatar: user.avatar || "",
    };
  }
  return { userId: id, username: "", name: "", avatar: "" };
};

export const snapshotCommunity = async (community) => {
  if (!community) return null;
  if (typeof community === "object" && (community.name || community.shortCode)) {
    const id = toId(community);
    if (!id) return null;
    return {
      communityId: id,
      name: community.name || "",
      shortCode: community.shortCode || "",
    };
  }

  const id = toId(community);
  if (!id) return null;
  const doc = await Community.findById(id).select("name shortCode").lean();
  if (!doc) return { communityId: id, name: "", shortCode: "" };
  return {
    communityId: doc._id,
    name: doc.name || "",
    shortCode: doc.shortCode || "",
  };
};

export const snapshotEntity = (kind, entity) => {
  if (!kind || !entity) return null;
  const id = toId(entity);
  if (!id) return null;
  if (typeof entity === "object") {
    return {
      kind,
      targetId: id,
      shortCode: entity.shortCode || "",
      title: entity.title || entity.name || "",
    };
  }
  return { kind, targetId: id, shortCode: "", title: "" };
};

export const formatNotification = (doc) => {
  const n = doc?.toObject ? doc.toObject() : doc;
  if (!n) return null;
  const idOf = (value) => (value ? String(value) : null);
  return {
    id: idOf(n._id),
    type: n.type,
    title: n.title,
    body: n.body || "",
    isUnread: !n.readAt,
    createdAt: n.createdAt,
    actor: n.actor
      ? {
          id: idOf(n.actor.userId),
          username: n.actor.username || "",
          name: n.actor.name || "",
          avatar: n.actor.avatar || "",
        }
      : null,
    community: n.community
      ? {
          id: idOf(n.community.communityId),
          name: n.community.name || "",
          shortCode: n.community.shortCode || "",
        }
      : null,
    entity: n.entity
      ? {
          kind: n.entity.kind,
          id: idOf(n.entity.targetId),
          shortCode: n.entity.shortCode || "",
          title: n.entity.title || "",
        }
      : null,
  };
};

export const getCommunityStewardIds = async (communityId) => {
  const id = toId(communityId);
  if (!id) return [];

  const [community, members] = await Promise.all([
    Community.findById(id).select("owner").lean(),
    CommunityMember.find({
      community: id,
      status: "active",
      role: { $in: ["owner", "moderator"] },
    }).select("user role moderatorExpiresAt status"),
  ]);

  const ids = [];
  if (community?.owner) ids.push(String(community.owner));
  for (const member of members) {
    const role = getEffectiveMemberRole(member);
    if (role === "owner" || role === "moderator") {
      ids.push(String(member.user));
    }
  }
  return [...new Set(ids)];
};

export const getAdminIds = async () => {
  const now = Date.now();
  if (adminIdCache.at && now - adminIdCache.at < ADMIN_ID_CACHE_MS) {
    return adminIdCache.ids;
  }
  const admins = await User.find({ role: "admin", status: "active" })
    .select("_id")
    .lean();
  const ids = admins.map((user) => String(user._id));
  adminIdCache = { ids, at: now };
  return ids;
};

export const isAdminNotificationType = (type) => ADMIN_TYPE_SET.has(type);

const emitNotification = (io, recipientId, payload) => {
  if (!io || !recipientId || !payload) return;
  io.to(userNotificationRoom(recipientId)).emit("notification:new", payload);
};

const createOne = async ({
  io,
  recipientId,
  actor,
  type,
  title,
  body = "",
  entity,
  community,
  collapse = false,
}) => {
  const recipient = toId(recipientId);
  if (!recipient || !type || !title) return null;
  if (actor && idsEqual(recipient, actor)) return null;

  if (!isAdminNotificationType(type)) {
    const adminIds = await getAdminIds();
    if (adminIds.includes(String(recipient))) return null;
  }

  const actorSnap = snapshotUser(actor);
  const communitySnap = await snapshotCommunity(community);
  const entitySnap = entity
    ? snapshotEntity(entity.kind, entity)
    : null;

  if (collapse && actorSnap?.userId && entitySnap?.targetId) {
    const existing = await Notification.findOneAndUpdate(
      {
        recipient,
        type,
        "actor.userId": actorSnap.userId,
        "entity.kind": entitySnap.kind,
        "entity.targetId": entitySnap.targetId,
        readAt: null,
      },
      {
        $set: {
          title,
          body: body || "",
          actor: actorSnap,
          community: communitySnap,
          entity: entitySnap,
          createdAt: new Date(),
        },
      },
      { new: true }
    );

    if (existing) {
      const formatted = formatNotification(existing);
      emitNotification(io, recipient, formatted);
      return formatted;
    }
  }

  const created = await Notification.create({
    recipient,
    actor: actorSnap,
    type,
    title,
    body: body || "",
    entity: entitySnap,
    community: communitySnap,
    readAt: null,
  });

  const formatted = formatNotification(created);
  emitNotification(io, recipient, formatted);
  return formatted;
};

/** Never throws — notifications must not fail the calling request. */
export const notify = async (opts) => {
  try {
    return await createOne(opts);
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
};

export const notifyMany = async (recipientIds, opts) => {
  const unique = [
    ...new Set(
      (recipientIds || [])
        .map((id) => (id ? String(toId(id)) : ""))
        .filter(Boolean)
    ),
  ];
  const actorId = opts?.actor ? String(toId(opts.actor)) : "";
  await Promise.all(
    unique
      .filter((id) => id !== actorId)
      .map((recipientId) => notify({ ...opts, recipientId }))
  );
};

/** Fan-out a platform event to every active admin. Never throws. */
export const notifyAdmins = async (opts) => {
  try {
    const ids = await getAdminIds();
    await notifyMany(ids, opts);
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
};
