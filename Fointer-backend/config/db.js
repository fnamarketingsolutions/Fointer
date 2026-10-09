import mongoose from "mongoose";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
import User from "../models/user.js";
import { backfillShortCodes } from "../utils/shortCode.js";

// Records created before short codes existed have none, and their URLs cannot
// be built until they do. This is a no-op once every record has a code.
const backfillMissingShortCodes = async () => {
  try {
    const [communities, posts] = await Promise.all([
      backfillShortCodes(Community),
      backfillShortCodes(Post),
    ]);
    if (communities || posts) {
      console.log(
        `Short codes backfilled: ${communities} communities, ${posts} posts`
      );
    }
  } catch (error) {
    console.log(`Short code backfill failed: ${error.message}`);
  }
};

/** One-time style sync for denormalized engagement counters. */
const backfillEngagementCounts = async () => {
  try {
    const needsBackfill = await Post.exists({
      $or: [
        { likeCount: { $exists: false } },
        { commentCount: { $exists: false } },
      ],
    });
    const needsCommentBackfill = await Comment.exists({
      likeCount: { $exists: false },
    });

    if (!needsBackfill && !needsCommentBackfill) return;

    if (needsBackfill) {
      const [likeCounts, commentCounts] = await Promise.all([
        Reaction.aggregate([
          { $match: { targetType: "post" } },
          { $group: { _id: "$targetId", count: { $sum: 1 } } },
        ]),
        Comment.aggregate([
          { $group: { _id: "$post", count: { $sum: 1 } } },
        ]),
      ]);

      const likeMap = new Map(
        likeCounts.map((row) => [String(row._id), row.count])
      );
      const commentMap = new Map(
        commentCounts.map((row) => [String(row._id), row.count])
      );

      const posts = await Post.find({})
        .select("_id likeCount commentCount")
        .lean();
      const ops = posts.map((post) => ({
        updateOne: {
          filter: { _id: post._id },
          update: {
            $set: {
              likeCount: likeMap.get(String(post._id)) || 0,
              commentCount: commentMap.get(String(post._id)) || 0,
            },
          },
        },
      }));

      if (ops.length) {
        await Post.bulkWrite(ops, { ordered: false });
      }
    }

    if (needsCommentBackfill) {
      const likeCounts = await Reaction.aggregate([
        { $match: { targetType: "comment" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } },
      ]);
      const likeMap = new Map(
        likeCounts.map((row) => [String(row._id), row.count])
      );
      const comments = await Comment.find({})
        .select("_id likeCount")
        .lean();
      const ops = comments.map((comment) => ({
        updateOne: {
          filter: { _id: comment._id },
          update: {
            $set: {
              likeCount: likeMap.get(String(comment._id)) || 0,
            },
          },
        },
      }));
      if (ops.length) {
        await Comment.bulkWrite(ops, { ordered: false });
      }
    }

    console.log("Engagement counts backfilled");
  } catch (error) {
    console.log(`Engagement count backfill failed: ${error.message}`);
  }
};

/**
 * Phase 1 Admin Management: promote existing platform admins that were never
 * flagged (legacy docs) to super admin so they keep full panel access.
 */
const backfillSuperAdmins = async () => {
  try {
    // Only legacy docs missing the flag — never overwrite limited admins.
    const result = await User.updateMany(
      {
        role: { $regex: /^admin$/i },
        $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: null }],
      },
      {
        $set: { isSuperAdmin: true, adminTabs: [] },
      }
    );

    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;
    if (matched || modified) {
      console.log(
        `Super-admin backfill: matched ${matched}, updated ${modified}`
      );
    }
  } catch (error) {
    console.log(`Super-admin backfill failed: ${error.message}`);
  }
};

/** One aggregation instead of a per-community member lookup on every browse. */
const backfillMemberCounts = async () => {
  const needs = await Community.exists({ memberCount: { $exists: false } });
  if (!needs) return;

  const counts = await CommunityMember.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$community", count: { $sum: 1 } } },
  ]);

  if (counts.length) {
    await Community.bulkWrite(
      counts.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { memberCount: row.count } },
        },
      })),
      { ordered: false }
    );
  }

  await Community.updateMany(
    {
      _id: { $nin: counts.map((row) => row._id) },
      memberCount: { $exists: false },
    },
    { $set: { memberCount: 0 } }
  );
  console.log(`Member counts backfilled for ${counts.length} communities`);
};

/** Mark which posts belong on the public feed so list queries can use an index. */
const backfillOpenFeed = async () => {
  const missingArchived = await Post.exists({ isArchived: { $exists: false } });
  if (missingArchived) {
    await Post.updateMany(
      { isArchived: { $exists: false } },
      { $set: { isArchived: false } }
    );
  }

  const needs = await Post.exists({ openFeed: { $exists: false } });
  if (!needs) return;

  const publicIds = await Community.find({ type: "public" }).distinct("_id");
  const opened = await Post.updateMany(
    {
      openFeed: { $exists: false },
      $or: [
        { community: null },
        { community: { $exists: false } },
        { community: { $in: publicIds } },
      ],
    },
    { $set: { openFeed: true } }
  );
  const closed = await Post.updateMany(
    { openFeed: { $exists: false } },
    { $set: { openFeed: false } }
  );
  const openedCount = opened.modifiedCount ?? opened.nModified ?? 0;
  const closedCount = closed.modifiedCount ?? closed.nModified ?? 0;
  console.log(
    `Open-feed flags backfilled: ${openedCount} public, ${closedCount} private`
  );
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected ${conn.connection.host}`);
    await backfillMissingShortCodes();
    await backfillEngagementCounts();
    await backfillSuperAdmins();
    await backfillMemberCounts();
    await backfillOpenFeed();
    await Promise.all([
      Community.collection.createIndex({ type: 1, memberCount: -1, createdAt: -1 }),
      Post.collection.createIndex({ openFeed: 1, isArchived: 1, createdAt: -1 }),
      Post.collection.createIndex({
        openFeed: 1,
        isArchived: 1,
        likeCount: -1,
        createdAt: -1,
      }),
      Post.collection.createIndex({
        openFeed: 1,
        isArchived: 1,
        commentCount: -1,
        createdAt: -1,
      }),
    ]);
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

export default connectDB;
