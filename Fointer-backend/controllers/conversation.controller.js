import mongoose from "mongoose";
import Conversation from "../models/conversation.js";
import DirectMessage from "../models/directMessage.js";
import User from "../models/user.js";
import Listing from "../models/listing.js";
import Post from "../models/post.js";
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
import { acceptSignedMediaList } from "../utils/cloudinary.js";
import { getBlockState, isMessagingBlocked } from "./block.controller.js";
import {
  getEditWindowMinutes,
  isWithinEditWindow,
} from "../utils/communityPermissions.js";
import { canViewPost } from "./post.controller.js";
import { hasMarketplaceAdminPower } from "../utils/adminAccess.js";
import { formatUserRef } from "../utils/deletedUser.js";

const DM_MEDIA_MAX = 4;

const formatDuration = (seconds = 0) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const previewFromCall = (call) => {
  if (!call) return "Call";
  const kind = call.mode === "video" ? "Video call" : "Audio call";
  if (call.status === "completed") {
    return `${kind} · ${formatDuration(call.durationSec)}`;
  }
  if (call.status === "missed") return `Missed ${kind.toLowerCase()}`;
  if (call.status === "rejected") return `Declined ${kind.toLowerCase()}`;
  if (call.status === "cancelled") return `Cancelled ${kind.toLowerCase()}`;
  return kind;
};

const previewFromMessage = (messageOrText, media = []) => {
  if (messageOrText && typeof messageOrText === "object") {
    if (messageOrText.type === "call" || messageOrText.call) {
      return previewFromCall(messageOrText.call);
    }
    const cleanText = String(messageOrText.text || "").trim();
    if (cleanText) return snippet(cleanText, 200);
    if (messageOrText.listing?.title) {
      return `Listing: ${snippet(messageOrText.listing.title, 80)}`;
    }
    if (messageOrText.listing) return "Shared a listing";
    if (messageOrText.post?.title) {
      return `Post: ${snippet(messageOrText.post.title, 80)}`;
    }
    if (messageOrText.post) return "Shared a post";
    return previewFromMessage("", messageOrText.media);
  }
  const clean = String(messageOrText || "").trim();
  if (clean) return snippet(clean, 200);
  const items = Array.isArray(media) ? media : [];
  if (!items.length) return "";
  const hasVideo = items.some((m) => m.type === "video");
  const hasImage = items.some((m) => m.type === "image");
  if (hasVideo && hasImage) return "Sent media";
  if (hasVideo) return items.length > 1 ? "Sent videos" : "Sent a video";
  return items.length > 1 ? "Sent photos" : "Sent a photo";
};

const formatReplySnapshot = (reply) => {
  if (!reply || typeof reply !== "object" || !reply._id) return null;
  return {
    id: reply._id,
    text: reply.isDeleted ? "" : reply.text || "",
    type: reply.type || "text",
    isDeleted: Boolean(reply.isDeleted),
    author: formatUser(reply.author),
  };
};

const formatUser = (user) => formatUserRef(user);

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

export const formatPostSnapshot = (post) => {
  if (!post) return null;
  const id = post._id || post.id || post.postId;
  if (!id) return null;
  const media = post.media || [];
  const firstImage = media.find((m) => m.type === "image") || media[0];
  const community =
    post.community && typeof post.community === "object"
      ? post.community
      : null;
  const communityId =
    community?._id || community?.id || post.community || null;
  return {
    postId: id,
    shortCode: post.shortCode || "",
    title: post.title || "",
    text: snippet(String(post.text || "").trim(), 120),
    imageUrl: firstImage?.url || "",
    communityId: communityId || undefined,
    communityShortCode: community?.shortCode || "",
    communityName: community?.name || "",
  };
};

export const formatMessage = (message, extras = {}) => {
  const type =
    message.type ||
    (message.call ? "call" : (message.media || []).length ? "media" : "text");
  const isAuthor =
    extras.viewerId != null &&
    String(message.author?._id || message.author) === String(extras.viewerId);
  const withinWindow =
    extras.editWindowMinutes != null
      ? Date.now() - new Date(message.createdAt).getTime() <
        Math.max(1, Number(extras.editWindowMinutes) || 60) * 60 * 1000
      : null;

  return {
    id: message._id,
    conversationId: message.conversation?._id || message.conversation,
    type,
    text: message.isDeleted ? "" : message.text || "",
    media: message.isDeleted ? [] : message.media || [],
    call: message.isDeleted ? null : message.call || null,
    listing: message.isDeleted ? null : message.listing || null,
    post: message.isDeleted ? null : message.post || null,
    replyTo: formatReplySnapshot(message.replyTo),
    author: formatUser(message.author),
    isDeleted: Boolean(message.isDeleted),
    deletedBy: message.deletedBy
      ? formatUser(message.deletedBy)
      : message.deletedBy || null,
    editedAt: message.editedAt || null,
    canEdit:
      extras.canEdit != null
        ? extras.canEdit
        : Boolean(
            isAuthor &&
              !message.isDeleted &&
              type !== "call" &&
              withinWindow
          ),
    canDelete:
      extras.canDelete != null
        ? extras.canDelete
        : Boolean(isAuthor && !message.isDeleted && type !== "call"),
    editWindowMinutes: extras.editWindowMinutes ?? null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

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
    .select("text media author createdAt type call listing post");

  if (!latest) {
    conversation.lastMessageText = "";
    conversation.lastMessageAt = conversation.createdAt;
    conversation.lastMessageAuthor = null;
  } else {
    conversation.lastMessageText = previewFromMessage(latest);
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

export const formatConversation = async (
  conversation,
  viewerId,
  userMap,
  { includeBlock = false } = {}
) => {
  const uid = String(viewerId);
  const otherRow = (conversation.participants || []).find(
    (p) => String(p.user?._id || p.user) !== uid
  );
  const otherId = otherRow?.user?._id || otherRow?.user;
  const otherUser = userMap?.get(String(otherId)) || null;
  const unreadCount = await countUnread(conversation, viewerId);
  const blockState =
    includeBlock && otherId
      ? await getBlockState(viewerId, otherId)
      : { isBlocked: false, blockedByMe: false };

  return {
    id: conversation._id,
    otherUser: formatUser(otherUser || otherId),
    listing: conversation.listing || null,
    lastMessageText: conversation.lastMessageText || "",
    lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
    unreadCount,
    isBlocked: blockState.isBlocked,
    blockedByMe: blockState.blockedByMe,
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
  media = [],
  listingSnapshot = null,
  postSnapshot = null,
  replyTo = null,
  type = "text",
  call = null,
  io = null,
  notifyRecipient = true,
}) => {
  const cleanText = String(text || "").trim();
  const mediaItems = Array.isArray(media) ? media.slice(0, DM_MEDIA_MAX) : [];
  const hasShareCard = Boolean(listingSnapshot || postSnapshot);
  const messageType =
    type === "call"
      ? "call"
      : mediaItems.length
        ? cleanText
          ? "text"
          : "media"
        : "text";

  if (
    messageType !== "call" &&
    !cleanText &&
    !mediaItems.length &&
    !hasShareCard
  ) {
    throw new Error("Message cannot be empty.");
  }

  let replyToId = null;
  if (replyTo) {
    const parent = await DirectMessage.findOne({
      _id: replyTo,
      conversation: conversation._id,
    }).select("_id");
    if (!parent) {
      throw new Error("Reply target message not found.");
    }
    replyToId = parent._id;
  }

  const message = await DirectMessage.create({
    conversation: conversation._id,
    author: author._id || author,
    type: messageType,
    text: messageType === "call" ? cleanText || previewFromCall(call) : cleanText,
    media: mediaItems,
    call: messageType === "call" ? call : null,
    replyTo: replyToId,
    listing: listingSnapshot || null,
    post: postSnapshot || null,
  });

  conversation.lastMessageText = previewFromMessage(message);
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

  await message.populate([
    { path: "author", select: "username name avatar" },
    {
      path: "replyTo",
      select: "text type isDeleted author",
      populate: { path: "author", select: "username name avatar" },
    },
  ]);
  const editWindowMinutes = await getEditWindowMinutes();
  const formatted = formatMessage(message, {
    viewerId: author._id || author,
    editWindowMinutes,
  });

  const recipientId = getOtherParticipantId(conversation, author._id || author);
  if (notifyRecipient && recipientId && messageType !== "call") {
    await notify({
      io,
      recipientId,
      actor: author,
      type: "direct_message",
      title: `${personName(author)} sent you a message`,
      body: previewFromMessage(message),
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
    if (recipientId) {
      io.to(`user:${recipientId}`).emit("dm_unread_changed", {
        conversationId: String(conversation._id),
      });
    }
  }

  return { message: formatted, conversation };
};

export const recordCallHistoryMessage = async ({
  conversationId,
  authorId,
  mode = "audio",
  status = "completed",
  durationSec = 0,
  startedAt = null,
  endedAt = null,
  io = null,
}) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !authorId) return null;

  const call = {
    mode: mode === "video" ? "video" : "audio",
    status: ["completed", "missed", "rejected", "cancelled"].includes(status)
      ? status
      : "completed",
    durationSec: Math.max(0, Math.floor(Number(durationSec) || 0)),
    startedAt: startedAt ? new Date(startedAt) : null,
    endedAt: endedAt ? new Date(endedAt) : new Date(),
  };

  const author = await User.findById(authorId).select("username name avatar");
  if (!author) return null;

  return sendDirectMessage({
    conversation,
    author,
    text: previewFromCall(call),
    type: "call",
    call,
    io,
    notifyRecipient: false,
  });
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

    const unreadTotal = formatted.reduce(
      (sum, conv) => sum + (Number(conv.unreadCount) || 0),
      0
    );

    return res.json({
      success: true,
      conversations: formatted,
      unreadTotal,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load conversations.");
  }
};

export const getUnreadTotal = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      "participants.user": req.user._id,
    })
      .select("participants lastMessageAt createdAt")
      .lean();

    const uid = String(req.user._id);
    const visible = conversations.filter((conv) => {
      const row = (conv.participants || []).find(
        (p) => String(p.user?._id || p.user) === uid
      );
      if (!row?.hiddenAt) return true;
      const hiddenAt = new Date(row.hiddenAt).getTime();
      const lastAt = new Date(conv.lastMessageAt || conv.createdAt).getTime();
      return lastAt > hiddenAt;
    });

    const counts = await Promise.all(
      visible.map((conv) => countUnread(conv, req.user._id))
    );
    const unreadTotal = counts.reduce((sum, count) => sum + count, 0);

    return res.json({
      success: true,
      unreadTotal,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load unread count.");
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

    if (await isMessagingBlocked(req.user._id, otherUser._id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user.",
      });
    }

    let listingSnapshot = null;
    if (listingId) {
      const listing = await Listing.findById(
        await resolveDocumentId(Listing, listingId)
      );
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found.",
        });
      }
      const isOwner =
        String(listing.seller?._id || listing.seller) === String(req.user._id);
      const canShareListing =
        listing.status === "active" ||
        isOwner ||
        hasMarketplaceAdminPower(req.user);
      if (!canShareListing) {
        return res.status(403).json({
          success: false,
          message: "You cannot share this listing.",
        });
      }
      listingSnapshot = formatListingSnapshot(listing);
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
      userMap,
      { includeBlock: true }
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
      userMap,
      { includeBlock: true }
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
      .populate("author", "username name avatar")
      .populate("deletedBy", "username name avatar")
      .populate({
        path: "replyTo",
        select: "text type isDeleted author",
        populate: { path: "author", select: "username name avatar" },
      });

    if (enabled) {
      query.skip(skip).limit(limit + 1);
    } else {
      query.limit(100);
    }

    const rows = await query;
    const { rows: pageRows, hasMore } = enabled
      ? takePage(rows, limit)
      : { rows, hasMore: false };

    const editWindowMinutes = await getEditWindowMinutes();
    const messages = pageRows.reverse().map((message) =>
      formatMessage(message, {
        viewerId: req.user._id,
        editWindowMinutes,
      })
    );
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

    const otherId = getOtherParticipantId(conversation, req.user._id);
    if (otherId && (await isMessagingBlocked(req.user._id, otherId))) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user.",
      });
    }

    const text = String(req.body.text || "").trim();
    const mediaList = Array.isArray(req.body.media) ? req.body.media : [];
    const listingId = req.body.listingId;
    const postId = req.body.postId;

    if (isUnsafeObjectInput(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing id.",
      });
    }
    if (isUnsafeObjectInput(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id.",
      });
    }

    if (!text && !mediaList.length && !listingId && !postId) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    if (mediaList.length > DM_MEDIA_MAX) {
      return res.status(400).json({
        success: false,
        message: `You can attach up to ${DM_MEDIA_MAX} photos or videos.`,
      });
    }

    let media = [];
    if (mediaList.length) {
      const accepted = acceptSignedMediaList(req.user._id, mediaList, []);
      if (!accepted.ok) {
        return res.status(400).json({
          success: false,
          message: accepted.message || "Invalid media upload.",
        });
      }
      media = accepted.items || [];
    }

    if (text && (await respondIfBanned(res, text))) return;

    let replyTo = null;
    if (req.body.replyTo) {
      const parent = await DirectMessage.findOne({
        _id: req.body.replyTo,
        conversation: conversation._id,
      }).select("_id");
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Reply target message not found.",
        });
      }
      replyTo = parent._id;
    }

    let listingSnapshot = null;
    if (listingId) {
      const listing = await Listing.findById(
        await resolveDocumentId(Listing, listingId)
      );
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found.",
        });
      }
      const isOwner =
        String(listing.seller?._id || listing.seller) === String(req.user._id);
      const canShareListing =
        listing.status === "active" ||
        isOwner ||
        hasMarketplaceAdminPower(req.user);
      if (!canShareListing) {
        return res.status(403).json({
          success: false,
          message: "You cannot share this listing.",
        });
      }
      listingSnapshot = formatListingSnapshot(listing);
    }

    let postSnapshot = null;
    if (postId) {
      const post = await Post.findById(
        await resolveDocumentId(Post, postId)
      ).populate("community", "name shortCode type");
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }
      if (!(await canViewPost(post, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You cannot share this post.",
        });
      }
      postSnapshot = formatPostSnapshot(post);
    }

    if (!text && !media.length && !listingSnapshot && !postSnapshot) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    const { message } = await sendDirectMessage({
      conversation,
      author: req.user,
      text,
      media,
      listingSnapshot,
      postSnapshot,
      replyTo,
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

    const io = req.app.get("io");
    io?.to(`user:${req.user._id}`).emit("dm_unread_changed", {
      conversationId: String(conversation._id),
    });

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

    if (message.type === "call" || message.call) {
      return res.status(400).json({
        success: false,
        message: "Call history cannot be edited.",
      });
    }

    const editWindowMinutes = await getEditWindowMinutes();
    if (!(await isWithinEditWindow(message.createdAt))) {
      return res.status(403).json({
        success: false,
        message: "Edit window expired.",
        editWindowMinutes,
        code: "EDIT_WINDOW_EXPIRED",
      });
    }

    const text = String(req.body.text || "").trim();
    if (!text && !(message.media || []).length) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    if (text && (await respondIfBanned(res, text))) return;

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
      conversation.lastMessageText = previewFromMessage(message);
      await conversation.save();
    }

    await message.populate({
      path: "replyTo",
      select: "text type isDeleted author",
      populate: { path: "author", select: "username name avatar" },
    });

    const formatted = formatMessage(message, {
      viewerId: req.user._id,
      editWindowMinutes,
    });
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
        message: formatMessage(message, {
          viewerId: req.user._id,
          editWindowMinutes: await getEditWindowMinutes(),
        }),
      });
    }

    if (message.type === "call" || message.call) {
      return res.status(400).json({
        success: false,
        message: "Call history cannot be deleted.",
      });
    }

    const editWindowMinutes = await getEditWindowMinutes();

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    message.text = "";
    message.media = [];
    await message.save();
    await message.populate("deletedBy", "username name avatar");

    await syncConversationPreview(conversation);

    const formatted = formatMessage(message, {
      viewerId: req.user._id,
      editWindowMinutes,
    });
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
