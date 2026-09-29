import mongoose from "mongoose";
import User from "../models/user.js";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
import Reshare from "../models/reshare.js";
import Bookmark from "../models/bookmark.js";
import Follow from "../models/follow.js";
import UserBlock from "../models/userBlock.js";
import Listing from "../models/listing.js";
import Conversation from "../models/conversation.js";
import DirectMessage from "../models/directMessage.js";
import Notification from "../models/notification.js";
import PushDevice from "../models/pushDevice.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityInvite from "../models/communityInvite.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";
import WatchGroup from "../models/watchGroup.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import WatchGroupMessage from "../models/watchGroupMessage.js";
import LiveEvent from "../models/liveEvent.js";
import LiveMessage from "../models/liveMessage.js";
import Report from "../models/report.js";
import Warning from "../models/warning.js";
import SupportTicket from "../models/supportTicket.js";
import UserSupportRequest from "../models/userSupportRequest.js";
import { destroyManyFromCloudinary } from "../utils/cloudinary.js";

const mediaUrlsFromDocs = (docs = []) =>
  docs.flatMap((doc) =>
    (doc.media || [])
      .map((m) => m?.url)
      .filter(Boolean)
  );

const clampField = async (Model, ids, field) => {
  const unique = [...new Set(ids.map(String))].filter(Boolean);
  if (!unique.length) return;
  await Model.updateMany(
    { _id: { $in: unique }, [field]: { $lt: 0 } },
    { $set: { [field]: 0 } }
  );
};

const recountCommentCounts = async (postIds) => {
  const unique = [...new Set(postIds.map(String))].filter(Boolean);
  await Promise.all(
    unique.map(async (id) => {
      const count = await Comment.countDocuments({ post: id });
      await Post.updateOne({ _id: id }, { $set: { commentCount: count } });
    })
  );
};

/**
 * Permanently deletes a member account and associated personal data.
 * Callers must already verify password / confirmText and ownership gates.
 */
export const purgeUserAccount = async (userId) => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const cloudinaryUrls = [];

  const user = await User.findById(uid).lean();
  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  if (user.avatar) cloudinaryUrls.push(user.avatar);

  // --- Social / private ---
  await PushDevice.deleteMany({ user: uid });
  await Follow.deleteMany({ $or: [{ follower: uid }, { following: uid }] });
  await UserBlock.deleteMany({ $or: [{ blocker: uid }, { blocked: uid }] });
  await Bookmark.deleteMany({ user: uid });

  const userReactions = await Reaction.find({ user: uid })
    .select("targetType targetId")
    .lean();
  const likedPostIds = [];
  const likedCommentIds = [];
  for (const r of userReactions) {
    if (r.targetType === "post") likedPostIds.push(r.targetId);
    else if (r.targetType === "comment") likedCommentIds.push(r.targetId);
  }
  await Reaction.deleteMany({ user: uid });
  if (likedPostIds.length) {
    await Post.updateMany(
      { _id: { $in: likedPostIds } },
      { $inc: { likeCount: -1 } }
    );
    await clampField(Post, likedPostIds, "likeCount");
  }
  if (likedCommentIds.length) {
    await Comment.updateMany(
      { _id: { $in: likedCommentIds } },
      { $inc: { likeCount: -1 } }
    );
    await clampField(Comment, likedCommentIds, "likeCount");
  }

  const userReshares = await Reshare.find({ user: uid }).select("post").lean();
  const resharedPostIds = userReshares.map((r) => r.post).filter(Boolean);
  await Reshare.deleteMany({ user: uid });
  if (resharedPostIds.length) {
    await Post.updateMany(
      { _id: { $in: resharedPostIds } },
      { $inc: { reshareCount: -1 } }
    );
    await clampField(Post, resharedPostIds, "reshareCount");
  }

  // --- Notifications ---
  await Notification.deleteMany({ recipient: uid });
  await Notification.updateMany(
    { "actor.userId": uid },
    {
      $set: {
        "actor.username": "",
        "actor.name": "Deleted User",
        "actor.avatar": "",
        "actor.userId": null,
      },
    }
  );

  // --- Owned posts (cascade) ---
  const posts = await Post.find({ author: uid }).select("_id media").lean();
  const postIds = posts.map((p) => p._id);
  cloudinaryUrls.push(...mediaUrlsFromDocs(posts));

  if (postIds.length) {
    const commentsOnPosts = await Comment.find({ post: { $in: postIds } })
      .select("_id")
      .lean();
    const commentIdsOnPosts = commentsOnPosts.map((c) => c._id);

    await Reaction.deleteMany({
      $or: [
        { targetType: "post", targetId: { $in: postIds } },
        { targetType: "comment", targetId: { $in: commentIdsOnPosts } },
      ],
    });
    await Reshare.deleteMany({ post: { $in: postIds } });
    await Bookmark.deleteMany({
      targetType: "post",
      targetId: { $in: postIds },
    });
    if (commentIdsOnPosts.length) {
      await Comment.deleteMany({ _id: { $in: commentIdsOnPosts } });
    }
    await Post.deleteMany({ _id: { $in: postIds } });
  }

  // --- Remaining comments on others' posts ---
  const myComments = await Comment.find({ author: uid })
    .select("_id post")
    .lean();
  const myCommentIds = myComments.map((c) => c._id);
  let replyIds = [];
  if (myCommentIds.length) {
    const replies = await Comment.find({ parent: { $in: myCommentIds } })
      .select("_id post")
      .lean();
    replyIds = replies.map((r) => r._id);
  }
  const allCommentIds = [...myCommentIds, ...replyIds];
  const affectedPostIds = [
    ...myComments.map((c) => c.post),
    ...(await Comment.find({ _id: { $in: replyIds } }).distinct("post")),
  ];

  if (allCommentIds.length) {
    await Reaction.deleteMany({
      targetType: "comment",
      targetId: { $in: allCommentIds },
    });
    await Comment.deleteMany({ _id: { $in: allCommentIds } });
    await recountCommentCounts(affectedPostIds);
  }

  // --- Listings ---
  const listings = await Listing.find({ seller: uid }).select("media").lean();
  cloudinaryUrls.push(...mediaUrlsFromDocs(listings));
  await Listing.deleteMany({ seller: uid });
  await Listing.updateMany({ removedBy: uid }, { $set: { removedBy: null } });

  // --- Communities (membership only; ownership blocked earlier) ---
  await CommunityMember.deleteMany({ user: uid });
  await CommunityMember.updateMany(
    { bannedBy: uid },
    { $set: { bannedBy: null } }
  );
  await CommunityInvite.deleteMany({
    $or: [{ inviter: uid }, { invitee: uid }],
  });
  await CommunityJoinRequest.deleteMany({ user: uid });

  // --- Watch groups / live ---
  await WatchGroupMember.deleteMany({ user: uid });
  await WatchGroupMember.updateMany(
    { removedBy: uid },
    { $set: { removedBy: null } }
  );
  await WatchGroupMessage.deleteMany({ author: uid });

  const hostedEvents = await LiveEvent.find({ host: uid }).select("_id").lean();
  const hostedEventIds = hostedEvents.map((e) => e._id);
  if (hostedEventIds.length) {
    await LiveMessage.deleteMany({ event: { $in: hostedEventIds } });
    await LiveEvent.deleteMany({ _id: { $in: hostedEventIds } });
  }
  await LiveMessage.deleteMany({ author: uid });

  // --- DMs: strip media PII, anonymize author, keep peer history ---
  const dmMediaMessages = await DirectMessage.find({
    author: uid,
    "media.0": { $exists: true },
  })
    .select("media")
    .lean();
  cloudinaryUrls.push(...mediaUrlsFromDocs(dmMediaMessages));

  await DirectMessage.updateMany(
    { author: uid },
    {
      $set: {
        author: null,
        media: [],
        deletedBy: null,
      },
    }
  );
  await DirectMessage.updateMany(
    { deletedBy: uid },
    { $set: { deletedBy: null } }
  );
  await Conversation.updateMany(
    { lastMessageAuthor: uid },
    { $set: { lastMessageAuthor: null } }
  );

  // Hide conversations from the deleted user's side (peer still sees them)
  await Conversation.updateMany(
    { "participants.user": uid },
    {
      $set: {
        "participants.$[p].hiddenAt": new Date(),
        "participants.$[p].clearedAt": new Date(),
      },
    },
    { arrayFilters: [{ "p.user": uid }] }
  );

  // --- Support ---
  await SupportTicket.deleteMany({ user: uid });
  await UserSupportRequest.updateMany(
    { user: uid },
    {
      $set: {
        user: null,
        email: "deleted@user.invalid",
        phone: "deleted",
        message: "[Account deleted]",
      },
    }
  );

  // --- Moderation trail (keep rows, scrub identity on content author) ---
  // reporter ref may dangle after User.deleteOne — admin UI treats missing populate as deleted.
  await Report.updateMany(
    { "snapshot.authorId": uid },
    {
      $set: {
        "snapshot.authorId": null,
        "snapshot.authorName": "Deleted User",
      },
    }
  );
  await Report.updateMany(
    { "snapshot.messages.authorId": uid },
    {
      $set: {
        "snapshot.messages.$[m].authorId": null,
        "snapshot.messages.$[m].authorName": "Deleted User",
      },
    },
    { arrayFilters: [{ "m.authorId": uid }] }
  );
  await Report.updateMany(
    { reviewedBy: uid },
    { $set: { reviewedBy: null } }
  );

  await Warning.deleteMany({ user: uid });

  // --- Cloudinary (best-effort) ---
  try {
    await destroyManyFromCloudinary(cloudinaryUrls);
  } catch (err) {
    console.error("[accountDeletion] Cloudinary cleanup failed:", err?.message || err);
  }

  await User.deleteOne({ _id: uid });

  return { deletedUserId: String(uid) };
};

/**
 * Lists owned communities / watch groups that block account deletion.
 */
export const getAccountDeletionBlockers = async (userId) => {
  const uid = userId;
  const [communities, watchGroups] = await Promise.all([
    Community.find({ owner: uid }).select("name shortCode").lean(),
    WatchGroup.find({ owner: uid }).select("name shortCode").lean(),
  ]);
  return {
    communities: communities.map((c) => ({
      id: c._id,
      name: c.name,
      shortCode: c.shortCode || "",
    })),
    watchGroups: watchGroups.map((g) => ({
      id: g._id,
      name: g.name,
      shortCode: g.shortCode || "",
    })),
  };
};
