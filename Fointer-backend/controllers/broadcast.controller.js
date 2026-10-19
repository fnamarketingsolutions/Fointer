import Broadcast from "../models/broadcast.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { sendServerError } from "../utils/safeError.js";
import {
  formatNotification,
  snapshotUser,
  userNotificationRoom,
} from "../utils/notify.js";
import { pushNotificationToUsers } from "../utils/push.js";

const USER_BATCH = 300;
const TITLE_MAX = 120;
const BODY_MAX = 500;

const formatBroadcast = (doc) => {
  const row = doc?.toObject ? doc.toObject() : doc;
  const author = row.createdBy && typeof row.createdBy === "object"
    ? row.createdBy
    : null;
  return {
    id: String(row._id),
    title: row.title || "",
    body: row.body || "",
    status: row.status || "sent",
    recipientCount: Number(row.recipientCount) || 0,
    sentAt: row.sentAt || null,
    createdAt: row.createdAt,
    error: row.error || "",
    author: author
      ? {
          id: String(author._id),
          username: author.username || "",
          name: author.name || "",
        }
      : null,
  };
};

const deliverBroadcast = async (broadcast, actor, io) => {
  const actorSnap = snapshotUser(actor);
  const pushPayload = {
    id: String(broadcast._id),
    type: "admin_broadcast",
    title: broadcast.title,
    body: broadcast.body,
  };
  let recipientCount = 0;
  let lastId = null;

  while (true) {
    const query = { status: "active", role: "user" };
    if (lastId) query._id = { $gt: lastId };
    const users = await User.find(query)
      .sort({ _id: 1 })
      .limit(USER_BATCH)
      .select("_id")
      .lean();
    if (!users.length) break;
    lastId = users[users.length - 1]._id;

    const created = await Notification.insertMany(
      users.map((user) => ({
        recipient: user._id,
        actor: actorSnap,
        type: "admin_broadcast",
        title: broadcast.title,
        body: broadcast.body,
        entity: {
          kind: "broadcast",
          targetId: broadcast._id,
          shortCode: "",
          title: broadcast.title,
        },
        readAt: null,
      }))
    );
    recipientCount += created.length;

    if (io) {
      for (const doc of created) {
        io.to(userNotificationRoom(doc.recipient)).emit(
          "notification:new",
          formatNotification(doc)
        );
      }
    }

    await pushNotificationToUsers(
      users.map((user) => user._id),
      pushPayload
    );
  }

  broadcast.status = "sent";
  broadcast.recipientCount = recipientCount;
  broadcast.sentAt = new Date();
  broadcast.error = "";
  await broadcast.save();
  return broadcast;
};

export const listBroadcasts = async (req, res) => {
  try {
    const rows = await Broadcast.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("createdBy", "username name")
      .lean();
    return res.status(200).json({
      success: true,
      broadcasts: rows.map(formatBroadcast),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const sendBroadcast = async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, TITLE_MAX);
  const body = String(req.body?.body || "").trim().slice(0, BODY_MAX);
  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: "Title and message are required.",
    });
  }

  let broadcast;
  try {
    broadcast = await Broadcast.create({
      title,
      body,
      createdBy: req.user._id,
      status: "sending",
    });
    await deliverBroadcast(broadcast, req.user, req.app.get("io"));
    return res.status(200).json({
      success: true,
      message: `Broadcast sent to ${broadcast.recipientCount} users.`,
      broadcast: formatBroadcast(broadcast),
    });
  } catch (error) {
    if (broadcast?._id) {
      await Broadcast.updateOne(
        { _id: broadcast._id },
        {
          $set: {
            status: "failed",
            error: String(error?.message || "Send failed").slice(0, 300),
          },
        }
      ).catch(() => {});
    }
    return sendServerError(res, error);
  }
};
