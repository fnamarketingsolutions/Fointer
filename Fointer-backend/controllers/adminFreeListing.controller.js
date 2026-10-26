import FreeListing from "../models/freeListing.js";
import Report from "../models/report.js";
import User from "../models/user.js";
import { formatListing } from "./marketplace.controller.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { parsePagination, buildPaginationMeta, takePage } from "../utils/pagination.js";
import { escapeRegex } from "../utils/validate.js";
import { sendServerError } from "../utils/safeError.js";
import { acceptSignedMediaList, destroyManyFromS3 } from "../utils/s3.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { issueUserWarning } from "../utils/userWarnings.js";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "../models/listing.js";

const findFreeListing = async (param) => {
  const id = await resolveDocumentId(FreeListing, param);
  return id
    ? FreeListing.findById(id)
        .populate(
          "seller",
          "username name avatar status warningCount phone email"
        )
        .populate("store", "name slug status")
        .populate("storeCategory", "name")
    : null;
};

export const listAdminFreeListings = async (req, res) => {
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
    const q = String(req.query.q || "").trim();
    if (q) {
      filter.$or = [
        { title: { $regex: escapeRegex(q), $options: "i" } },
        { description: { $regex: escapeRegex(q), $options: "i" } },
      ];
    }
    if (String(req.query.reported || "").toLowerCase() === "true") {
      const reports = await Report.find({
        targetType: "listing",
        status: "pending",
      }).select("targetId").lean();
      filter._id = { $in: reports.map((report) => report.targetId) };
    }

    let query = FreeListing.find(filter)
      .sort({ createdAt: -1 })
      .populate("seller", "username name avatar status warningCount")
      .populate("store", "name slug status")
      .populate("storeCategory", "name");
    query = enabled ? query.skip(skip).limit(limit + 1) : query.limit(200);
    const found = await query;
    const { rows, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };
    const ids = rows.map((listing) => listing._id);
    const reportCounts = ids.length
      ? await Report.aggregate([
          {
            $match: {
              targetType: "listing",
              targetId: { $in: ids },
              status: "pending",
            },
          },
          { $group: { _id: "$targetId", count: { $sum: 1 } } },
        ])
      : [];
    const reportMap = new Map(reportCounts.map((item) => [String(item._id), item.count]));
    const listings = rows.map((listing) => ({
      ...formatListing(listing, { canEdit: true, canDelete: true, includeSellerContact: true }),
      sellerStatus: listing.seller?.status || "active",
      pendingReports: reportMap.get(String(listing._id)) || 0,
    }));
    const total = enabled ? await FreeListing.countDocuments(filter) : listings.length;
    const summary = {};
    for (const value of ["all", ...LISTING_STATUSES]) {
      summary[value] = await FreeListing.countDocuments(
        value === "all" ? {} : { status: value }
      );
    }
    return res.json({
      success: true,
      listings,
      categories: LISTING_CATEGORIES,
      statuses: LISTING_STATUSES,
      summary,
      pagination: enabled ? buildPaginationMeta({ page, limit, total, hasMore }) : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load free listings.");
  }
};

export const getAdminFreeListing = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    const pendingReports = await Report.countDocuments({
      targetType: "listing",
      targetId: listing._id,
      status: "pending",
    });
    return res.json({
      success: true,
      listing: {
        ...formatListing(listing, { canEdit: true, canDelete: true, includeSellerContact: true }),
        sellerStatus: listing.seller?.status || "active",
        pendingReports,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load free listing.");
  }
};

export const updateAdminFreeListing = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    if (req.body.title !== undefined && !String(req.body.title || "").trim()) {
      return res.status(400).json({ success: false, message: "Listing title is required." });
    }
    if (
      req.body.category !== undefined &&
      !LISTING_CATEGORIES.includes(String(req.body.category || "").toLowerCase())
    ) {
      return res.status(400).json({ success: false, message: "Invalid category." });
    }
    if (
      req.body.condition !== undefined &&
      !LISTING_CONDITIONS.includes(String(req.body.condition || "").toLowerCase())
    ) {
      return res.status(400).json({ success: false, message: "Invalid condition." });
    }
    if (
      req.body.status !== undefined &&
      !LISTING_STATUSES.includes(String(req.body.status || "").toLowerCase())
    ) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    const fields = [
      "title", "description", "category", "condition", "city", "state", "country", "status",
    ];
    for (const field of fields) {
      if (req.body[field] === undefined) continue;
      listing[field] = ["category", "condition", "status"].includes(field)
        ? String(req.body[field]).toLowerCase()
        : req.body[field];
    }
    const requestedStatus =
      req.body.status === undefined
        ? null
        : String(req.body.status || "").toLowerCase();
    listing.price = 0;
    listing.pricing = "free";
    if (req.body.media !== undefined) {
      const accepted = acceptSignedMediaList(
        req.user._id,
        Array.isArray(req.body.media) ? req.body.media : [],
        listing.media || []
      );
      if (!accepted.ok) {
        return res.status(400).json({ success: false, message: accepted.message });
      }
      const nextUrls = new Set(accepted.items.map((item) => item.url));
      const removed = (listing.media || [])
        .map((item) => item.url)
        .filter((url) => url && !nextUrls.has(url));
      listing.media = accepted.items;
      if (removed.length) await destroyManyFromS3(removed);
    }
    if (await respondIfBanned(res, listing.title, listing.description)) return;
    if (requestedStatus === "removed") {
      listing.removedAt = new Date();
      listing.removedBy = req.user._id;
      listing.hiddenAt = null;
      listing.hiddenReason = null;
    } else if (requestedStatus === "hidden") {
      listing.hiddenAt = new Date();
      listing.hiddenReason = "admin";
      listing.removedAt = null;
      listing.removedBy = null;
    } else if (requestedStatus === "active") {
      listing.removedAt = null;
      listing.removedBy = null;
      listing.hiddenAt = null;
      listing.hiddenReason = null;
    }
    await listing.save();
    return res.json({
      success: true,
      message: "Free listing updated.",
      listing: formatListing(listing, { canEdit: true, canDelete: true, includeSellerContact: true }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update free listing.");
  }
};

const setFreeListingStatus = async (req, res, status) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    if (status === "active") {
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
    } else {
      listing.status = "removed";
      listing.removedAt = new Date();
      listing.removedBy = req.user._id;
      listing.hiddenAt = null;
      listing.hiddenReason = null;
    }
    await listing.save();
    return res.json({ success: true, message: `Free listing ${status === "active" ? "restored" : "removed"}.` });
  } catch (error) {
    return sendServerError(res, error, `Failed to ${status === "active" ? "restore" : "remove"} free listing.`);
  }
};

export const removeAdminFreeListing = (req, res) =>
  setFreeListingStatus(req, res, "removed");

export const restoreAdminFreeListing = (req, res) =>
  setFreeListingStatus(req, res, "active");

export const warnFreeListingSeller = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ success: false, message: "Warning message is required." });
    }
    const result = await issueUserWarning({
      userId: listing.seller?._id || listing.seller,
      actor: req.user,
      message,
      source: "free_listing",
      relatedEntity: { kind: "listing", targetId: listing._id, title: listing.title || "" },
      io: req.app.get("io"),
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendServerError(res, error, "Failed to warn free listing seller.");
  }
};
