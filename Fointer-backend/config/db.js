import mongoose from "mongoose";
import Community from "../models/community.js";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
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

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected ${conn.connection.host}`);
    await backfillMissingShortCodes();
    await backfillEngagementCounts();
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

export default connectDB;
