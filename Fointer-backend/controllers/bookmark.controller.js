import Bookmark from "../models/bookmark.js";
import Post from "../models/post.js";
import Listing from "../models/listing.js";
import {
  BOOKMARK_TARGET_TYPES,
  resolveBookmarkTarget,
  toggleBookmark,
} from "../utils/bookmarkHelpers.js";
import { sendServerError } from "../utils/safeError.js";
import {
  buildPaginationMeta,
  parsePagination,
  takePage,
} from "../utils/pagination.js";
import { formatListing } from "./marketplace.controller.js";
import {
  canViewPost,
  formatPostForBookmark,
} from "./post.controller.js";

export const toggleMyBookmark = async (req, res) => {
  try {
    const targetType = req.body?.targetType || req.params?.targetType;
    const targetId = req.body?.targetId || req.params?.id;

    const resolved = await resolveBookmarkTarget(targetType, targetId);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    if (resolved.targetType === "post") {
      const post = await Post.findById(resolved.targetId)
        .populate("community", "type")
        .lean();
      if (!post || !(await canViewPost(post, req.user))) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }
    }

    const result = await toggleBookmark(
      req.user._id,
      resolved.targetType,
      resolved.targetId
    );

    return res.status(200).json({
      success: true,
      saved: result.saved,
      targetType: resolved.targetType,
      targetId: resolved.targetId,
      message: result.saved ? "Saved." : "Removed from saved.",
    });
  } catch (error) {
    return sendServerError(res, error, "Could not update bookmark.");
  }
};

export const listMyBookmarks = async (req, res) => {
  try {
    const typeFilter = String(req.query.type || "").trim().toLowerCase();
    const filter = { user: req.user._id };
    if (BOOKMARK_TARGET_TYPES.includes(typeFilter)) {
      filter.targetType = typeFilter;
    }

    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 30,
      maxLimit: 100,
    });

    let query = Bookmark.find(filter).sort({ createdAt: -1 }).lean();
    if (enabled) {
      query = query.skip(skip).limit(limit + 1);
    } else {
      query = query.limit(100);
    }

    const found = await query;
    const { rows, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };

    const postIds = rows
      .filter((row) => row.targetType === "post")
      .map((row) => row.targetId);
    const listingIds = rows
      .filter((row) => row.targetType === "listing")
      .map((row) => row.targetId);

    const [posts, listings] = await Promise.all([
      postIds.length
        ? Post.find({ _id: { $in: postIds } })
            .populate("author", "username name avatar role")
            .populate("community", "name shortCode coverImage type")
            .lean()
        : [],
      listingIds.length
        ? Listing.find({ _id: { $in: listingIds } })
            .populate(
              "seller",
              "username name avatar city state country phone email status"
            )
            .lean()
        : [],
    ]);

    const postMap = Object.fromEntries(posts.map((p) => [String(p._id), p]));
    const listingMap = Object.fromEntries(
      listings.map((l) => [String(l._id), l])
    );

    const items = [];
    for (const row of rows) {
      if (row.targetType === "post") {
        const post = postMap[String(row.targetId)];
        if (!post) continue;
        if (!(await canViewPost(post, req.user))) continue;
        const formatted = await formatPostForBookmark(post, req.user);
        items.push({
          id: row._id,
          targetType: "post",
          savedAt: row.createdAt,
          post: { ...formatted, savedByMe: true },
        });
      } else {
        const listing = listingMap[String(row.targetId)];
        if (!listing) continue;
        if (!["active", "sold"].includes(listing.status)) continue;
        items.push({
          id: row._id,
          targetType: "listing",
          savedAt: row.createdAt,
          listing: formatListing(listing, {
            isOwner:
              String(listing.seller?._id || listing.seller) ===
              String(req.user._id),
            canEdit: false,
            canDelete: false,
            canMarkSold: false,
            savedByMe: true,
          }),
        });
      }
    }

    const payload = { success: true, items };
    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, hasMore });
    }
    return res.status(200).json(payload);
  } catch (error) {
    return sendServerError(res, error, "Could not load saved items.");
  }
};
