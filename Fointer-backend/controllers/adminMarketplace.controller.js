import Listing, { LISTING_CATEGORIES, LISTING_STATUSES } from "../models/listing.js";
import Report from "../models/report.js";
import User from "../models/user.js";
import DirectMessage from "../models/directMessage.js";
import Conversation from "../models/conversation.js";
import {
  findListingByParam,
  formatListing,
} from "./marketplace.controller.js";
import { formatMessage } from "./conversation.controller.js";
import {
  parsePagination,
  buildPaginationMeta,
  takePage,
} from "../utils/pagination.js";
import { escapeRegex } from "../utils/validate.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import {
  acceptSignedMediaList,
  destroyManyFromCloudinary,
} from "../utils/cloudinary.js";

/**
 * Soft-hide seller's public listings on account ban.
 * Uses status "hidden" + hiddenReason "account_ban" (not moderation "removed").
 */
export const hideActiveListingsForSeller = async (sellerId) => {
  await Listing.updateMany(
    { seller: sellerId, status: "active" },
    {
      $set: {
        status: "hidden",
        hiddenAt: new Date(),
        hiddenReason: "account_ban",
      },
    }
  );
};

/**
 * Restore listings soft-hidden by account ban only.
 * Does not restore admin-hidden (`hiddenReason: "admin"`), removed, sold, or draft.
 * Legacy rows without hiddenReason are treated as ban-hidden.
 */
export const restoreHiddenListingsForSeller = async (sellerId) => {
  await Listing.updateMany(
    {
      seller: sellerId,
      status: "hidden",
      $or: [
        { hiddenReason: "account_ban" },
        { hiddenReason: null },
        { hiddenReason: { $exists: false } },
      ],
    },
    {
      $set: { status: "active" },
      $unset: { hiddenAt: 1, hiddenReason: 1 },
    }
  );
};

const getReportedListingIds = async () => {
  const rows = await Report.find({
    targetType: "listing",
    status: "pending",
  })
    .select("targetId")
    .lean();
  return [...new Set(rows.map((r) => String(r.targetId)))];
};

export const listAdminListings = async (req, res) => {
  try {
    const { page, limit, skip, enabled } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const filter = {};
    const status = String(req.query.status || "all").toLowerCase();
    if (status !== "all" && LISTING_STATUSES.includes(status)) {
      filter.status = status;
    }

    const category = String(req.query.category || "").toLowerCase();
    if (category && LISTING_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    const seller = String(req.query.seller || "").trim();
    if (seller) {
      const users = await User.find({
        $or: [
          { username: new RegExp(`^${escapeRegex(seller)}$`, "i") },
          { name: new RegExp(escapeRegex(seller), "i") },
        ],
      })
        .select("_id")
        .limit(20);
      filter.seller = { $in: users.map((u) => u._id) };
    }

    const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      filter.price = {};
      if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
      if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
    }

    const q = String(req.query.q || "").trim();
    if (q) {
      filter.$or = [
        { title: { $regex: escapeRegex(q), $options: "i" } },
        { description: { $regex: escapeRegex(q), $options: "i" } },
      ];
    }

    if (String(req.query.reported || "").toLowerCase() === "true") {
      const reportedIds = await getReportedListingIds();
      filter._id = { $in: reportedIds };
    }

    const query = Listing.find(filter)
      .sort({ createdAt: -1 })
      .populate("seller", "username name avatar status");

    if (enabled) query.skip(skip).limit(limit + 1);
    else query.limit(200);

    const rows = await query;
    const { rows: pageRows, hasMore } = enabled
      ? takePage(rows, limit)
      : { rows, hasMore: false };

    const listingIds = pageRows.map((l) => l._id);
    const reportCounts = await Report.aggregate([
      {
        $match: {
          targetType: "listing",
          targetId: { $in: listingIds },
          status: "pending",
        },
      },
      { $group: { _id: "$targetId", count: { $sum: 1 } } },
    ]);
    const reportMap = new Map(
      reportCounts.map((r) => [String(r._id), r.count])
    );

    const listings = pageRows.map((listing) => ({
      ...formatListing(listing, {
        isOwner: false,
        canEdit: true,
        canDelete: true,
        canMarkSold: false,
        includeSellerContact: true,
      }),
      sellerStatus: listing.seller?.status || "active",
      pendingReports: reportMap.get(String(listing._id)) || 0,
    }));

    const total = enabled ? await Listing.countDocuments(filter) : listings.length;

    const statusCounts = {};
    for (const s of ["all", ...LISTING_STATUSES]) {
      statusCounts[s] =
        s === "all"
          ? await Listing.countDocuments()
          : await Listing.countDocuments({ status: s });
    }

    return res.json({
      success: true,
      listings,
      categories: LISTING_CATEGORIES,
      statuses: LISTING_STATUSES,
      summary: statusCounts,
      pagination: enabled
        ? buildPaginationMeta({ page, limit, total, hasMore })
        : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load marketplace listings.");
  }
};

export const getAdminListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const pendingReports = await Report.countDocuments({
      targetType: "listing",
      targetId: listing._id,
      status: "pending",
    });

    return res.json({
      success: true,
      listing: {
        ...formatListing(listing, {
          canEdit: true,
          canDelete: true,
          includeSellerContact: true,
        }),
        sellerStatus: listing.seller?.status || "active",
        pendingReports,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load listing.");
  }
};

export const updateAdminListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const allowed = [
      "title",
      "description",
      "price",
      "currency",
      "category",
      "condition",
      "city",
      "state",
      "country",
      "status",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        listing[key] = req.body[key];
      }
    }

    if (req.body.media !== undefined) {
      const acceptedMedia = acceptSignedMediaList(
        req.user._id,
        Array.isArray(req.body.media) ? req.body.media : [],
        listing.media || []
      );
      if (!acceptedMedia.ok) {
        return res.status(400).json({
          success: false,
          message: acceptedMedia.message,
        });
      }
      const nextUrls = new Set(acceptedMedia.items.map((item) => item.url));
      const removed = (listing.media || [])
        .map((item) => item.url)
        .filter((url) => url && !nextUrls.has(url));
      listing.media = acceptedMedia.items;
      if (removed.length) {
        await destroyManyFromCloudinary(removed);
      }
    }

    if (await respondIfBanned(res, listing.title, listing.description)) return;

    if (req.body.status === "removed") {
      listing.removedAt = new Date();
      listing.removedBy = req.user._id;
      listing.hiddenAt = null;
      listing.hiddenReason = null;
    }
    if (req.body.status === "hidden") {
      listing.hiddenAt = new Date();
      listing.hiddenReason = "admin";
      listing.removedAt = null;
      listing.removedBy = null;
    }
    if (req.body.status === "active") {
      listing.removedAt = null;
      listing.removedBy = null;
      listing.hiddenAt = null;
      listing.hiddenReason = null;
    }

    await listing.save();
    await listing.populate(
      "seller",
      "username name avatar city state country phone email status"
    );

    return res.json({
      success: true,
      message: "Listing updated.",
      listing: formatListing(listing, {
        canEdit: true,
        canDelete: true,
        includeSellerContact: true,
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update listing.");
  }
};

export const removeAdminListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    listing.status = "removed";
    listing.removedAt = new Date();
    listing.removedBy = req.user._id;
    listing.hiddenAt = null;
    listing.hiddenReason = null;
    await listing.save();

    return res.json({
      success: true,
      message: "Listing removed from marketplace.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to remove listing.");
  }
};

export const restoreAdminListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const seller = await User.findById(listing.seller?._id || listing.seller)
      .select("status")
      .lean();
    if (seller && seller.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Cannot restore listing while seller account is not active.",
      });
    }

    listing.status = "active";
    listing.removedAt = null;
    listing.removedBy = null;
    listing.hiddenAt = null;
    listing.hiddenReason = null;
    await listing.save();

    return res.json({
      success: true,
      message: "Listing restored.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to restore listing.");
  }
};

export const listAdminUserListings = async (req, res) => {
  try {
    const userId = req.params.userId;
    const listings = await Listing.find({ seller: userId })
      .sort({ createdAt: -1 })
      .populate("seller", "username name avatar status");

    return res.json({
      success: true,
      listings: listings.map((listing) =>
        formatListing(listing, {
          canEdit: true,
          canDelete: true,
          includeSellerContact: true,
        })
      ),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load user listings.");
  }
};

export const listReportedConversations = async (req, res) => {
  try {
    const reports = await Report.find({
      targetType: "conversation",
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reporter", "username name avatar")
      .lean();

    const conversationIds = [
      ...new Set(reports.map((r) => String(r.targetId))),
    ];

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

    const items = reports.map((report) => {
      const conv = conversations.find(
        (c) => String(c._id) === String(report.targetId)
      );
      const participants = (conv?.participants || [])
        .map((p) => userMap.get(String(p.user)))
        .filter(Boolean)
        .map((u) => ({
          id: u._id,
          username: u.username,
          name: u.name,
          avatar: u.avatar || "",
        }));

      return {
        reportId: report._id,
        conversationId: report.targetId,
        reason: report.reason,
        details: report.details || "",
        snapshot: report.snapshot || {},
        reporter: report.reporter,
        participants,
        createdAt: report.createdAt,
      };
    });

    return res.json({
      success: true,
      reportedConversations: items,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load reported conversations.");
  }
};

export const getAdminConversationMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const hasReport = await Report.exists({
      targetType: "conversation",
      targetId: conversationId,
      status: "pending",
    });
    if (!hasReport) {
      return res.status(403).json({
        success: false,
        message:
          "Conversation messages are only available for threads with a pending report.",
      });
    }

    const messages = await DirectMessage.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("author", "username name avatar");

    return res.json({
      success: true,
      messages: messages.map(formatMessage),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load conversation messages.");
  }
};

export const warnListingSeller = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const sellerId = listing.seller?._id || listing.seller;
    const note = String(req.body.message || "").trim();
    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Warning message is required.",
      });
    }

    const { issueUserWarning } = await import("../utils/userWarnings.js");
    const result = await issueUserWarning({
      userId: sellerId,
      actor: req.user,
      message: note,
      source: "marketplace",
      relatedEntity: {
        kind: "listing",
        targetId: listing._id,
        title: listing.title || "",
      },
      io: req.app.get("io"),
    });

    return res.json({
      success: true,
      message: result.banned
        ? "Warning sent. Seller was auto-banned after reaching the limit."
        : "Warning sent to seller.",
      warningCount: result.warningCount,
      banned: result.banned,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to warn seller.",
      });
    }
    return sendServerError(res, error, "Failed to warn seller.");
  }
};
