import mongoose from "mongoose";
import Conversation from "../models/conversation.js";
import DirectMessage from "../models/directMessage.js";
import User from "../models/user.js";
import Listing from "../models/listing.js";
import {
  parsePagination,
  buildPaginationMeta,
  takePage,
} from "../utils/pagination.js";
import { resolveDocumentId, parseObjectIdInput, isUnsafeObjectInput } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { notify, personName, snippet } from "../utils/notify.js";
import { normalizeUsername } from "./user.controller.js";

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

export const formatListingSnapshot = (listing) => {
  if (!listing) return null;
  const id = listing._id || listing.id || listing.listingId;
  if (!id) return null;
  const media = listing.media || [];
  const firstImage = media.find((m) => m.type === "image") || media[0];
  return {
    listingId: id,
    shortCode: listing.shortCode || "",
    title: listing.title || "",
    price: listing.price ?? 0,
    currency: listing.currency || "USD",
    imageUrl: firstImage?.url || "",
  };
};

export const formatMessage = (message) => ({
  id: message._id,
  conversationId: message.conversation?._id || message.conversation,
  text: message.isDeleted ? "" : message.text,
  listing: message.listing || null,
  author: formatUser(message.author),
  isDeleted: Boolean(message.isDeleted),
  editedAt: message.editedAt || null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const getParticipantRow = (conversation, userId) => {
  const uid = String(userId);
  return (conversation.participants || []).find(
    (row) => String(row.user?._id || row.user) === uid
  );
};

const syncConversationPreview = async (conversation) => {
  const latest = await DirectMessage.findOne({
    conversation: conversation._id,
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .select("text author createdAt");

  if (!latest) {
    conversation.lastMessageText = "";
    conversation.lastMessageAt = conversation.createdAt;
    conversation.lastMessageAuthor = null;
  } else {
    conversation.lastMessageText = snippet(latest.text, 200);
    conversation.lastMessageAt = latest.createdAt;
    conversation.lastMessageAuthor = latest.author;
  }
  await conversation.save();
};

const emitConversationEvent = (io, conversationId, event, payload) => {
  if (!io) return;
  io.to(`dm:${conversationId}`).emit(event, payload);
};

const buildParticipantKey = (userA, userB) => {
  const ids = [String(userA), String(userB)].sort();
  return `${ids[0]}:${ids[1]}`;
};

const toObjectId = (id) => {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.Types.ObjectId.createFromHexString(String(id));
};

export const userInConversation = (conversation, userId) => {
  if (!conversation || !userId) return false;
  const uid = String(userId);
  return (conversation.participants || []).some(
    (row) => String(row.user?._id || row.user) === uid
  );
};

export const findConversationByParam = async (param) => {
  const id = await resolveDocumentId(Conversation, param);
  if (!id) return null;
  return Conversation.findById(id);
};

const getOtherParticipantId = (conversation, userId) => {
  const uid = String(userId);
  const other = (conversation.participants || []).find(
    (row) => String(row.user?._id || row.user) !== uid
  );
  return other?.user?._id || other?.user || null;
};

const populateParticipants = async (conversationIds) => {
  const conversations = await Conversation.find({
    _id: { $in: conversationIds },
  }).lean();
  const userIds = new Set();
  for (const conv of conversations) {
    for (const row of conv.participants || []) {
      if (row.user) userIds.add(String(row.user));
    }
  }
  const users = await User.find({ _id: { $in: [...userIds] } })
    .select("username name avatar")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  return { conversations, userMap };
};

const countUnread = async (conversation, userId) => {
  const uid = String(userId);
  const row = (conversation.participants || []).find(
    (p) => String(p.user?._id || p.user) === uid
  );
  const lastReadAt = row?.lastReadAt || new Date(0);
  return DirectMessage.countDocuments({
    conversation: conversation._id,
    author: { $ne: userId },
    isDeleted: { $ne: true },
    createdAt: { $gt: lastReadAt },
  });
};

export const formatConversation = async (conversation, viewerId, userMap) => {
  const uid = String(viewerId);
  const otherRow = (conversation.participants || []).find(
    (p) => String(p.user?._id || p.user) !== uid
  );
  const otherId = otherRow?.user?._id || otherRow?.user;
  const otherUser = userMap?.get(String(otherId)) || null;
  const unreadCount = await countUnread(conversation, viewerId);

  return {
    id: conversation._id,
    otherUser: formatUser(otherUser || otherId),
    listing: conversation.listing || null,
    lastMessageText: conversation.lastMessageText || "",
    lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

export const getOrCreateConversation = async (
  userA,
  userB,
  { listingSnapshot = null } = {}
) => {
  if (String(userA) === String(userB)) {
    throw new Error("You cannot message yourself.");
  }

  const participantKey = buildParticipantKey(userA, userB);
  let conversation = await Conversation.findOne({ participantKey });

  if (!conversation) {
    const sorted = [userA, userB].map(toObjectId).sort((a, b) =>
      String(a).localeCompare(String(b))
    );

    conversation = await Conversation.create({
      participantKey,
      participants: sorted.map((user) => ({ user, lastReadAt: new Date() })),
      listing: listingSnapshot || null,
    });
  } else if (listingSnapshot && !conversation.listing) {
    conversation.listing = listingSnapshot;
    await conversation.save();
  }

  return conversation;
};

export const sendDirectMessage = async ({
  conversation,
  author,
  text,
  listingSnapshot = null,
  io = null,
}) => {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    throw new Error("Message cannot be empty.");
  }

  const message = await DirectMessage.create({
    conversation: conversation._id,
    author: author._id || author,
    text: cleanText,
    listing: listingSnapshot || null,
  });

  conversation.lastMessageText = snippet(cleanText, 200);
  conversation.lastMessageAt = new Date();
  conversation.lastMessageAuthor = author._id || author;

  const authorId = String(author._id || author);
  for (const row of conversation.participants || []) {
    const pid = String(row.user?._id || row.user);
    if (pid === authorId) {
      row.lastReadAt = new Date();
    } else {
      row.hiddenAt = null;
    }
  }
  await conversation.save();

  await message.populate("author", "username name avatar");
  const formatted = formatMessage(message);

  const recipientId = getOtherParticipantId(conversation, author._id || author);
  if (recipientId) {
    await notify({
      io,
      recipientId,
      actor: author,
      type: "direct_message",
      title: `${personName(author)} sent you a message`,
      body: snippet(cleanText, 200),
      entity: {
        kind: "conversation",
        _id: conversation._id,
        title: conversation.listing?.title || "",
      },
      collapse: true,
    });
  }

  if (io) {
    io.to(`dm:${conversation._id}`).emit("dm_new", {
      conversationId: String(conversation._id),
      message: formatted,
    });
  }

  return { message: formatted, conversation };
};

export const listConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      "participants.user": req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const uid = String(req.user._id);
    const visibleConversations = conversations.filter((conv) => {
      const row = (conv.participants || []).find(
        (p) => String(p.user?._id || p.user) === uid
      );
      if (!row?.hiddenAt) return true;
      const hiddenAt = new Date(row.hiddenAt).getTime();
      const lastAt = new Date(conv.lastMessageAt || conv.createdAt).getTime();
      return lastAt > hiddenAt;
    });

    const conversationIds = visibleConversations.map((conv) => conv._id);
    const idsWithMessages = new Set(
      (
        await DirectMessage.distinct("conversation", {
          conversation: { $in: conversationIds },
          isDeleted: { $ne: true },
        })
      ).map(String)
    );

    const conversationsWithMessages = visibleConversations.filter((conv) =>
      idsWithMessages.has(String(conv._id))
    );

    const userIds = new Set();
    for (const conv of conversationsWithMessages) {
      for (const row of conv.participants || []) {
        if (row.user) userIds.add(String(row.user));
      }
    }
    const users = await User.find({ _id: { $in: [...userIds] } })
      .select("username name avatar")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const formatted = await Promise.all(
      conversationsWithMessages.map((conv) =>
        formatConversation(conv, req.user._id, userMap)
      )
    );

    return res.json({
      success: true,
      conversations: formatted,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load conversations.");
  }
};

export const createConversation = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const parsedUserId = parseObjectIdInput(req.body.userId);
    const message = String(req.body.message || "").trim();
    const listingId = req.body.listingId;

    if (req.body.userId != null && req.body.userId !== "" && !parsedUserId) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    if (isUnsafeObjectInput(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing id.",
      });
    }

    let otherUser = null;
    if (parsedUserId) {
      otherUser = await User.findById(parsedUserId).select(
        "username name avatar status"
      );
    } else if (username) {
      otherUser = await User.findOne({ username }).select(
        "username name avatar status"
      );
    }

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (otherUser.status === "banned" || otherUser.status === "suspended") {
      return res.status(400).json({
        success: false,
        message: "You cannot message this user.",
      });
    }

    if (String(otherUser._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself.",
      });
    }

    let listingSnapshot = null;
    if (listingId) {
      const listing = await Listing.findById(
        await resolveDocumentId(Listing, listingId)
      );
      if (listing) {
        listingSnapshot = formatListingSnapshot(listing);
      }
    }

    const conversation = await getOrCreateConversation(
      req.user._id,
      otherUser._id,
      { listingSnapshot }
    );

    if (message) {
      if (await respondIfBanned(res, message)) return;
      await sendDirectMessage({
        conversation,
        author: req.user,
        text: message,
        listingSnapshot,
        io: req.app.get("io"),
      });
    }

    const userMap = new Map([[String(otherUser._id), otherUser]]);
    const formatted = await formatConversation(
      conversation.toObject(),
      req.user._id,
      userMap
    );

    return res.status(201).json({
      success: true,
      conversation: formatted,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to start conversation.");
  }
};

export const getConversation = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const otherId = getOtherParticipantId(conversation, req.user._id);
    const otherUser = await User.findById(otherId)
      .select("username name avatar")
      .lean();
    const userMap = new Map([[String(otherId), otherUser]]);
    const formatted = await formatConversation(
      conversation.toObject(),
      req.user._id,
      userMap
    );

    return res.json({
      success: true,
      conversation: formatted,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load conversation.");
  }
};

export const listMessages = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const { page, limit, skip, enabled } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const participantRow = getParticipantRow(conversation, req.user._id);
    const clearedAt = participantRow?.clearedAt || null;

    const messageFilter = { conversation: conversation._id };
    if (clearedAt) {
      messageFilter.createdAt = { $gt: clearedAt };
    }

    const query = DirectMessage.find(messageFilter)
      .sort({ createdAt: -1 })
      .populate("author", "username name avatar");

    if (enabled) {
      query.skip(skip).limit(limit + 1);
    } else {
      query.limit(100);
    }

    const rows = await query;
    const { rows: pageRows, hasMore } = enabled
      ? takePage(rows, limit)
      : { rows, hasMore: false };

    const messages = pageRows.reverse().map(formatMessage);
    const total = enabled
      ? await DirectMessage.countDocuments(messageFilter)
      : messages.length;

    return res.json({
      success: true,
      messages,
      pagination: enabled
        ? buildPaginationMeta({ page, limit, total, hasMore })
        : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load messages.");
  }
};

export const postMessage = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    if (await respondIfBanned(res, text)) return;

    let listingSnapshot = null;
    const listingId = req.body.listingId;
    if (isUnsafeObjectInput(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing id.",
      });
    }
    if (listingId) {
      const listing = await Listing.findById(
        await resolveDocumentId(Listing, listingId)
      );
      if (listing) {
        listingSnapshot = formatListingSnapshot(listing);
      }
    }

    const { message } = await sendDirectMessage({
      conversation,
      author: req.user,
      text,
      listingSnapshot,
      io: req.app.get("io"),
    });

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to send message.");
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const uid = String(req.user._id);
    for (const row of conversation.participants) {
      if (String(row.user?._id || row.user) === uid) {
        row.lastReadAt = new Date();
      }
    }
    await conversation.save();

    return res.json({
      success: true,
      message: "Marked as read.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to mark conversation as read.");
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const now = new Date();
    const uid = String(req.user._id);
    for (const row of conversation.participants) {
      if (String(row.user?._id || row.user) === uid) {
        row.hiddenAt = now;
        row.clearedAt = now;
        row.lastReadAt = now;
      }
    }
    await conversation.save();

    return res.json({
      success: true,
      message: "Conversation deleted from your inbox.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete conversation.");
  }
};

export const updateMessage = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const message = await DirectMessage.findOne({
      _id: req.params.messageId,
      conversation: conversation._id,
    }).populate("author", "username name avatar");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    if (String(message.author?._id || message.author) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages.",
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be edited.",
      });
    }

    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    if (await respondIfBanned(res, text)) return;

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const latest = await DirectMessage.findOne({
      conversation: conversation._id,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .select("_id");

    if (latest && String(latest._id) === String(message._id)) {
      conversation.lastMessageText = snippet(text, 200);
      await conversation.save();
    }

    const formatted = formatMessage(message);
    emitConversationEvent(req.app.get("io"), conversation._id, "dm_updated", {
      conversationId: String(conversation._id),
      message: formatted,
    });

    return res.json({
      success: true,
      message: formatted,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update message.");
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const conversation = await findConversationByParam(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userInConversation(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation.",
      });
    }

    const message = await DirectMessage.findOne({
      _id: req.params.messageId,
      conversation: conversation._id,
    }).populate("author", "username name avatar");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    if (String(message.author?._id || message.author) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages.",
      });
    }

    if (message.isDeleted) {
      return res.json({
        success: true,
        message: formatMessage(message),
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.text = "";
    await message.save();

    await syncConversationPreview(conversation);

    const formatted = formatMessage(message);
    emitConversationEvent(req.app.get("io"), conversation._id, "dm_deleted", {
      conversationId: String(conversation._id),
      message: formatted,
    });

    return res.json({
      success: true,
      message: formatted,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete message.");
  }
};
