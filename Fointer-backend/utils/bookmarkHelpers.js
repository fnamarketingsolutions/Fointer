import Bookmark from "../models/bookmark.js";
import Post from "../models/post.js";
import Listing from "../models/listing.js";
import { parseObjectIdInput, resolveDocumentId } from "./shortCode.js";

export const BOOKMARK_TARGET_TYPES = ["post", "listing"];

export const getBookmarkMeta = async (targetType, targetIds, userId) => {
  const saved = {};
  for (const id of targetIds || []) {
    saved[String(id)] = false;
  }

  if (!targetType || !targetIds?.length || !userId) {
    return { saved };
  }

  const rows = await Bookmark.find({
    targetType,
    targetId: { $in: targetIds },
    user: userId,
  })
    .select("targetId")
    .lean();

  for (const row of rows) {
    saved[String(row.targetId)] = true;
  }

  return { saved };
};

export const resolveBookmarkTarget = async (targetType, rawId) => {
  const type = String(targetType || "").trim().toLowerCase();
  if (!BOOKMARK_TARGET_TYPES.includes(type)) {
    return { ok: false, status: 400, message: "Invalid bookmark type." };
  }

  if (type === "post") {
    const id = parseObjectIdInput(rawId);
    if (!id) {
      return { ok: false, status: 400, message: "Invalid post id." };
    }
    const doc = await Post.findById(id).select("_id").lean();
    if (!doc) {
      return { ok: false, status: 404, message: "Post not found." };
    }
    return { ok: true, targetType: type, targetId: doc._id };
  }

  const id = await resolveDocumentId(Listing, rawId);
  if (!id) {
    return { ok: false, status: 404, message: "Listing not found." };
  }
  const doc = await Listing.findById(id).select("_id").lean();
  if (!doc) {
    return { ok: false, status: 404, message: "Listing not found." };
  }
  return { ok: true, targetType: type, targetId: doc._id };
};

export const toggleBookmark = async (userId, targetType, targetId) => {
  const existing = await Bookmark.findOne({
    user: userId,
    targetType,
    targetId,
  });

  if (existing) {
    await existing.deleteOne();
    return { saved: false };
  }

  try {
    await Bookmark.create({ user: userId, targetType, targetId });
  } catch (error) {
    if (error?.code === 11000) {
      return { saved: true };
    }
    throw error;
  }

  return { saved: true };
};
