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
import { destroyManyFromCloudinary } from "../utils/cloudinary.js";
import { notify, personName } from "../utils/notify.js";

export const hideActiveListingsForSeller = async (sellerId, removedBy = null) => {
  const update = {
    status: "removed",
    removedAt: new Date(),
  };
  if (removedBy) update.removedBy = removedBy;
  await Listing.updateMany(
    { seller: sellerId, status: "active" },
    { $set: update }
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

    if (await respondIfBanned(res, listing.title, listing.description)) return;

    if (req.body.status === "removed") {
      listing.removedAt = new Date();
      listing.removedBy = req.user._id;
    }
    if (req.body.status === "active") {
      listing.removedAt = null;
      listing.removedBy = null;
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
    });
    if (!hasReport) {
      return res.status(403).json({
        success: false,
        message: "Conversation messages are only available for reported threads.",
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

    await notify({
      io: req.app.get("io"),
      recipientId: sellerId,
      actor: req.user,
      type: "support_ticket",
      title: "Marketplace listing policy notice",
      body: note.slice(0, 200),
      entity: {
        kind: "listing",
        _id: listing._id,
        title: listing.title || "",
        shortCode: listing.shortCode || "",
      },
    });

    return res.json({
      success: true,
      message: "Warning sent to seller.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to warn seller.");
  }
};
