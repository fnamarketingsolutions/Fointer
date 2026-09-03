import Report, {
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  REPORT_STATUSES,
} from "../models/report.js";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
import User from "../models/user.js";
import LiveEvent from "../models/liveEvent.js";
import WatchGroup from "../models/watchGroup.js";
import Community from "../models/community.js";
import Listing from "../models/listing.js";
import Conversation from "../models/conversation.js";
import DirectMessage from "../models/directMessage.js";
import { sendServerError } from "../utils/safeError.js";
import { parseObjectIdInput } from "../utils/shortCode.js";
import { canViewPost } from "./post.controller.js";
import { notifyAdmins, notify, personName, snippet } from "../utils/notify.js";
import {
  hideActiveListingsForSeller,
} from "./adminMarketplace.controller.js";
import { userInConversation, formatListingSnapshot } from "./conversation.controller.js";

const formatUser = (user) => {
  if (!user || typeof user !== "object" || !user._id) {
    return user ? { id: user } : null;
  }
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
    status: user.status || "active",
  };
};

const reasonLabel = (reason) =>
  ({
    spam: "Spam",
    harassment: "Harassment / bullying",
    sexual_content: "Sexual / explicit content",
    hate_speech: "Hate speech",
    violence: "Violence / threats",
    misinformation: "Misinformation",
    other: "Other",
  })[reason] || reason;

const formatReport = (report, { includeSnapshot = true } = {}) => ({
  id: report._id,
  targetType: report.targetType,
  targetId: report.targetId,
  reason: report.reason,
  reasonLabel: reasonLabel(report.reason),
  details: report.details || "",
  status: report.status,
  snapshot: includeSnapshot ? report.snapshot || {} : {},
  reporter: formatUser(report.reporter),
  reviewedBy: formatUser(report.reviewedBy),
  reviewedAt: report.reviewedAt || null,
  adminNote: report.adminNote || "",
  actionTaken: report.actionTaken || "",
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  targetExists: Boolean(report._targetExists),
});

const buildPostSnapshot = (post) => {
  const author = post.author;
  return {
    title: post.title || "",
    text: post.text || "",
    authorId: author?._id || post.author || null,
    authorName:
      (author && typeof author === "object"
        ? author.name || author.username
        : "") || "",
    communityName:
      post.community && typeof post.community === "object"
        ? post.community.name || ""
        : "",
    postId: post._id,
  };
};

const buildCommentSnapshot = (comment) => {
  const author = comment.author;
  const post = comment.post;
  return {
    title: post && typeof post === "object" ? post.title || "" : "",
    text: comment.text || "",
    authorId: author?._id || comment.author || null,
    authorName:
      (author && typeof author === "object"
        ? author.name || author.username
        : "") || "",
    communityName:
      post &&
      typeof post === "object" &&
      post.community &&
      typeof post.community === "object"
        ? post.community.name || ""
        : "",
    postId: post?._id || comment.post || null,
  };
};

const buildListingReportSnapshot = (listing) => {
  const seller = listing.seller;
  const snap = formatListingSnapshot(listing);
  return {
    title: listing.title || "",
    text: listing.description || "",
    authorId: seller?._id || listing.seller || null,
    authorName:
      (seller && typeof seller === "object"
        ? seller.name || seller.username
        : "") || "",
    communityName: "",
    postId: null,
    listingPrice: snap?.price ?? listing.price,
    listingCurrency: snap?.currency || listing.currency || "USD",
    listingImageUrl: snap?.imageUrl || "",
  };
};

const CONVERSATION_SNAPSHOT_MESSAGE_LIMIT = 50;

const buildConversationReportSnapshot = async (conversation, reporterId) => {
  const other = (conversation.participants || []).find(
    (p) => String(p.user?._id || p.user) !== String(reporterId)
  );
  const otherUser = other?.user;
  const authorId = otherUser?._id || other?.user || null;
  const authorName =
    otherUser && typeof otherUser === "object"
      ? otherUser.name || otherUser.username || ""
      : "";

  const messages = await DirectMessage.find({
    conversation: conversation._id,
  })
    .sort({ createdAt: 1 })
    .limit(CONVERSATION_SNAPSHOT_MESSAGE_LIMIT)
    .populate("author", "username name");

  const formattedMessages = messages.map((msg) => {
    const author = msg.author;
    const name =
      author && typeof author === "object"
        ? author.name || author.username || "User"
        : "User";
    return {
      authorId: author?._id || msg.author || null,
      authorName: name,
      text: msg.text || "",
      createdAt: msg.createdAt,
    };
  });

  const textPreview = formattedMessages
    .slice(-8)
    .map((m) => `${m.authorName}: ${m.text}`)
    .join("\n");

  return {
    title: "Reported conversation",
    text: textPreview,
    authorId,
    authorName,
    communityName: "",
    postId: null,
    conversationId: conversation._id,
    messages: formattedMessages,
  };
};

const deleteTargetContent = async (targetType, targetId) => {
  if (targetType === "post") {
    const post = await Post.findById(targetId);
    if (!post) return { deleted: false, message: "Post already removed." };
    const comments = await Comment.find({ post: post._id }).select("_id");
    const commentIds = comments.map((c) => c._id);
    await Reaction.deleteMany({
      $or: [
        { targetType: "post", targetId: post._id },
        { targetType: "comment", targetId: { $in: commentIds } },
      ],
    });
    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    return { deleted: true, message: "Post deleted." };
  }

  if (targetType === "comment") {
    const comment = await Comment.findById(targetId);
    if (!comment) return { deleted: false, message: "Comment already removed." };
    const replies = await Comment.find({ parent: comment._id }).select("_id");
    const ids = [comment._id, ...replies.map((r) => r._id)];
    const postId = comment.post;
    await Reaction.deleteMany({
      targetType: "comment",
      targetId: { $in: ids },
    });
    await Comment.deleteMany({ _id: { $in: ids } });
    await Post.updateOne(
      { _id: postId },
      { $inc: { commentCount: -ids.length } }
    );
    await Post.updateOne(
      { _id: postId, commentCount: { $lt: 0 } },
      { $set: { commentCount: 0 } }
    );
    return { deleted: true, message: "Comment deleted." };
  }

  if (targetType === "listing") {
    const listing = await Listing.findById(targetId);
    if (!listing) {
      return { deleted: false, message: "Listing already removed." };
    }
    listing.status = "removed";
    listing.removedAt = new Date();
    await listing.save();
    return { deleted: true, message: "Listing removed from marketplace." };
  }

  if (targetType === "conversation") {
    return {
      deleted: false,
      message:
        "Conversation retained. Ban the reported user or remove related listings if needed.",
    };
  }

  return { deleted: false, message: "Unknown target type." };
};

export const createReport = async (req, res) => {
  try {
    const targetType = String(req.body.targetType || "")
      .toLowerCase()
      .trim();
    const targetId = parseObjectIdInput(req.body.targetId);
    const reason = String(req.body.reason || "")
      .toLowerCase()
      .trim();
    const details = String(req.body.details || "").trim();

    if (!REPORT_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report target.",
      });
    }
    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: "Valid target id is required.",
      });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid reason.",
      });
    }

    let snapshot;
    if (targetType === "post") {
      const post = await Post.findById(targetId)
        .populate("author", "username name")
        .populate("community", "name");
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }
      if (!(await canViewPost(post, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You cannot report this post.",
        });
      }
      if (String(post.author?._id || post.author) === String(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: "You cannot report your own post.",
        });
      }
      snapshot = buildPostSnapshot(post);
    } else if (targetType === "comment") {
      const comment = await Comment.findById(targetId)
        .populate("author", "username name")
        .populate({
          path: "post",
          select: "title community",
          populate: { path: "community", select: "name type" },
        });
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found.",
        });
      }
      const commentPost = comment.post;
      if (
        !commentPost ||
        typeof commentPost !== "object" ||
        !(await canViewPost(commentPost, req.user))
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot report this comment.",
        });
      }
      if (
        String(comment.author?._id || comment.author) === String(req.user._id)
      ) {
        return res.status(400).json({
          success: false,
          message: "You cannot report your own comment.",
        });
      }
      snapshot = buildCommentSnapshot(comment);
    } else if (targetType === "listing") {
      const listing = await Listing.findById(targetId).populate(
        "seller",
        "username name"
      );
      if (!listing || listing.status === "removed") {
        return res.status(404).json({
          success: false,
          message: "Listing not found.",
        });
      }
      if (String(listing.seller?._id || listing.seller) === String(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: "You cannot report your own listing.",
        });
      }
      snapshot = buildListingReportSnapshot(listing);
    } else if (targetType === "conversation") {
      const conversation = await Conversation.findById(targetId).populate(
        "participants.user",
        "username name"
      );
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }
      if (!userInConversation(conversation, req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "You cannot report this conversation.",
        });
      }
      snapshot = await buildConversationReportSnapshot(conversation, req.user._id);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid report target.",
      });
    }

    const existing = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      status: "pending",
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending report on this content.",
      });
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      details,
      snapshot,
      status: "pending",
    });

    await report.populate("reporter", "username name avatar status");

    await notifyAdmins({
      io: req.app.get("io"),
      actor: req.user,
      type: "content_report",
      title: `${personName(req.user)} reported a ${targetType}`,
      body: details
        ? `${reasonLabel(reason)} — ${snippet(details)}`
        : reasonLabel(reason),
      entity: {
        kind: "report",
        id: report._id,
        title: snapshot?.title || reasonLabel(reason),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Report submitted. Our team will review it.",
      report: formatReport(report, { includeSnapshot: false }),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending report on this content.",
      });
    }
    return sendServerError(res, error, "Failed to submit report.");
  }
};

export const listAdminReports = async (req, res) => {
  try {
    const status = String(req.query.status || "pending").toLowerCase();
    const q = String(req.query.q || "").trim();
    const filter = {};

    if (status !== "all" && REPORT_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(
        q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [
        { details: regex },
        { "snapshot.text": regex },
        { "snapshot.title": regex },
        { "snapshot.authorName": regex },
        { "snapshot.communityName": regex },
        { reason: regex },
      ];
    }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("reporter", "username name avatar status")
      .populate("reviewedBy", "username name avatar")
      .lean();

    const enriched = await Promise.all(
      reports.map(async (r) => {
        let exists = false;
        if (r.targetType === "post") {
          exists = Boolean(await Post.exists({ _id: r.targetId }));
        } else if (r.targetType === "comment") {
          exists = Boolean(await Comment.exists({ _id: r.targetId }));
        } else if (r.targetType === "listing") {
          const listing = await Listing.findById(r.targetId).select("status");
          exists = Boolean(listing && listing.status !== "removed");
        } else if (r.targetType === "conversation") {
          exists = Boolean(await Conversation.exists({ _id: r.targetId }));
        }
        return formatReport({ ...r, _targetExists: exists });
      })
    );

    const [pending, reviewed, actioned, dismissed, all] = await Promise.all([
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "reviewed" }),
      Report.countDocuments({ status: "actioned" }),
      Report.countDocuments({ status: "dismissed" }),
      Report.countDocuments(),
    ]);

    return res.json({
      success: true,
      reports: enriched,
      summary: { all, pending, reviewed, actioned, dismissed },
      reasons: REPORT_REASONS.map((r) => ({
        id: r,
        label: reasonLabel(r),
      })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list reports.");
  }
};

export const updateAdminReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found.",
      });
    }

    const status = String(req.body.status || "")
      .toLowerCase()
      .trim();
    const adminNote = String(req.body.adminNote || "").trim();
    const action =
      String(req.body.action || "")
        .toLowerCase()
        .trim() || null;
    // actions: dismiss | delete_content | ban_author | delete_and_ban | warn_seller | remove_listing

    let actionTaken = report.actionTaken || "";

    if (action === "dismiss" || status === "dismissed") {
      report.status = "dismissed";
      actionTaken = actionTaken || "Dismissed — no violation found";
    } else if (
      action === "delete_content" ||
      action === "delete_and_ban" ||
      action === "remove_listing"
    ) {
      const result = await deleteTargetContent(
        report.targetType,
        report.targetId
      );
      actionTaken = result.message;
      if (action === "delete_and_ban" && report.snapshot?.authorId) {
        await User.findByIdAndUpdate(report.snapshot.authorId, {
          status: "banned",
        });
        await hideActiveListingsForSeller(
          report.snapshot.authorId,
          req.user._id
        );
        actionTaken += "; author banned";
      }
      report.status = "actioned";
    } else if (action === "warn_seller") {
      if (!report.snapshot?.authorId) {
        return res.status(400).json({
          success: false,
          message: "Seller information is unavailable for this report.",
        });
      }
      const warning = adminNote || "Your marketplace listing may violate Fointer policies. Please review and update it.";
      await notify({
        io: req.app.get("io"),
        recipientId: report.snapshot.authorId,
        actor: req.user,
        type: "support_ticket",
        title: "Marketplace policy notice",
        body: snippet(warning, 200),
        entity: {
          kind: "listing",
          _id: report.targetId,
          title: report.snapshot?.title || "",
        },
      });
      actionTaken = "Warning sent to seller";
      report.status = "actioned";
    } else if (action === "ban_author") {
      if (!report.snapshot?.authorId) {
        return res.status(400).json({
          success: false,
          message: "Author information is unavailable for this report.",
        });
      }
      await User.findByIdAndUpdate(report.snapshot.authorId, {
        status: "banned",
      });
      await hideActiveListingsForSeller(
        report.snapshot.authorId,
        req.user._id
      );
      actionTaken = "Author banned; active listings hidden";
      report.status = "actioned";
    } else if (status && REPORT_STATUSES.includes(status)) {
      report.status = status;
    } else if (!action && !status) {
      return res.status(400).json({
        success: false,
        message: "Provide an action or status update.",
      });
    }

    if (adminNote) report.adminNote = adminNote;
    report.actionTaken = actionTaken;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    await report.save();

    await report.populate("reporter", "username name avatar status");
    await report.populate("reviewedBy", "username name avatar");

    let exists = false;
    if (report.targetType === "post") {
      exists = Boolean(await Post.exists({ _id: report.targetId }));
    } else if (report.targetType === "comment") {
      exists = Boolean(await Comment.exists({ _id: report.targetId }));
    } else if (report.targetType === "listing") {
      const listing = await Listing.findById(report.targetId).select("status");
      exists = Boolean(listing && listing.status !== "removed");
    } else if (report.targetType === "conversation") {
      exists = Boolean(await Conversation.exists({ _id: report.targetId }));
    }

    return res.json({
      success: true,
      message: "Report updated.",
      report: formatReport({
        ...report.toObject(),
        _targetExists: exists,
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update report.");
  }
};

export const getReportingAnalytics = async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      pendingReports,
      actionedReports,
      dismissedReports,
      reportsThisWeek,
      totalPosts,
      totalComments,
      totalUsers,
      bannedUsers,
      totalCommunities,
      liveEvents,
      watchGroups,
      reportsByReason,
      reportsByDay,
    ] = await Promise.all([
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "actioned" }),
      Report.countDocuments({ status: "dismissed" }),
      Report.countDocuments({ createdAt: { $gte: weekAgo } }),
      Post.countDocuments(),
      Comment.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ status: "banned" }),
      Community.countDocuments(),
      LiveEvent.countDocuments({ status: "live" }),
      WatchGroup.countDocuments(),
      Report.aggregate([
        { $group: { _id: "$reason", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Report.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      analytics: {
        pendingReports,
        actionedReports,
        dismissedReports,
        reportsThisWeek,
        totalPosts,
        totalComments,
        totalUsers,
        bannedUsers,
        totalCommunities,
        liveEvents,
        watchGroups,
        reportsByReason: reportsByReason.map((r) => ({
          reason: r._id,
          label: reasonLabel(r._id),
          count: r.count,
        })),
        reportsByDay: reportsByDay.map((d) => ({
          date: d._id,
          count: d.count,
        })),
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load analytics.");
  }
};

export const getReportReasons = async (_req, res) => {
  return res.json({
    success: true,
    reasons: REPORT_REASONS.map((r) => ({
      id: r,
      label: reasonLabel(r),
    })),
  });
};
