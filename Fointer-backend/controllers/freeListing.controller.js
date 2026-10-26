import FreeListing from "../models/freeListing.js";
import User from "../models/user.js";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "../models/listing.js";
import { formatListing } from "./marketplace.controller.js";
import {
  formatListingSnapshot,
  getOrCreateConversation,
  sendDirectMessage,
} from "./conversation.controller.js";
import { isMessagingBlocked } from "./block.controller.js";
import { peekEditWindowMinutes } from "../utils/communityPermissions.js";
import { getBookmarkMeta } from "../utils/bookmarkHelpers.js";
import { parsePagination, buildPaginationMeta, takePage } from "../utils/pagination.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { acceptSignedMediaList, destroyManyFromS3 } from "../utils/s3.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { escapeRegex } from "../utils/validate.js";
import { sendServerError } from "../utils/safeError.js";
import { hasFreeListingsAdminPower } from "../utils/adminAccess.js";

const SELLER_FIELDS = "username name avatar city state country status";
const SELLER_CONTACT_FIELDS = `${SELLER_FIELDS} phone email warningCount`;
const FREE_LISTING_SORT = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};
const findFreeListing = async (param, includeContact = false) => {
  const id = await resolveDocumentId(FreeListing, param);
  if (!id) return null;
  return FreeListing.findById(id)
    .populate("seller", includeContact ? SELLER_CONTACT_FIELDS : SELLER_FIELDS)
    .populate("community", "name")
    .populate("store", "name slug status")
    .populate("storeCategory", "name");
};

const listingFlags = (listing, user) => {
  const isOwner =
    Boolean(user?._id) &&
    String(listing.seller?._id || listing.seller) === String(user._id);
  const isAdmin = hasFreeListingsAdminPower(user);
  const isWithinEditWindow =
    listing.createdAt &&
    Date.now() - new Date(listing.createdAt).getTime() <
      peekEditWindowMinutes() * 60 * 1000;
  const canEdit = isAdmin || (isOwner && isWithinEditWindow);
  return {
    isOwner,
    canEdit,
    canChangeStatus:
      isAdmin ||
      (isOwner &&
        !listing.removedBy &&
        !["removed", "hidden"].includes(listing.status)),
    canDelete: isOwner || isAdmin,
    isLocked: Boolean(isOwner && !isAdmin && !isWithinEditWindow),
    editWindowMinutes: peekEditWindowMinutes(),
    canMarkSold: isOwner && listing.status === "active" && !listing.removedBy,
    includeSellerContact: isOwner || isAdmin,
  };
};

const serialize = async (listing, user, savedByMe = false) => {
  const flags = listingFlags(listing, user);
  if (flags.includeSellerContact && !listing.populated("seller")) {
    await listing.populate("seller", SELLER_CONTACT_FIELDS);
  }
  return formatListing(listing, { ...flags, savedByMe });
};

const makeFilter = (query, userId = null) => {
  const filter = userId ? { seller: userId } : { status: "active" };
  const status = String(query.status || "").toLowerCase();
  if (userId && LISTING_STATUSES.includes(status)) filter.status = status;
  const category = String(query.category || "").toLowerCase();
  if (LISTING_CATEGORIES.includes(category)) filter.category = category;
  const text = String(query.q || "").trim();
  if (text) {
    filter.$or = [
      { title: { $regex: escapeRegex(text), $options: "i" } },
      { description: { $regex: escapeRegex(text), $options: "i" } },
    ];
  }
  const city = String(query.city || "").trim();
  if (city) filter.city = { $regex: escapeRegex(city), $options: "i" };
  return filter;
};

export const listFreeListings = async (req, res) => {
  try {
    const { page, limit, skip, enabled } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const filter = makeFilter(req.query);
    const inactiveSellers = await User.find({ status: { $ne: "active" } })
      .select("_id")
      .lean();
    if (inactiveSellers.length) {
      filter.seller = { $nin: inactiveSellers.map((user) => user._id) };
    }
    let query = FreeListing.find(filter)
      .sort(FREE_LISTING_SORT[String(req.query.sort || "newest")] || FREE_LISTING_SORT.newest)
      .populate("seller", SELLER_FIELDS)
      .populate("community", "name")
      .populate("store", "name slug status")
      .populate("storeCategory", "name");
    query = enabled ? query.skip(skip).limit(limit + 1) : query.limit(200);
    const found = await query;
    const { rows, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };
    const { saved } = await getBookmarkMeta(
      "listing",
      rows.map((listing) => listing._id),
      req.user?._id
    );
    const listings = await Promise.all(
      rows.map((listing) =>
        serialize(listing, req.user, saved[String(listing._id)] || false)
      )
    );
    const total = enabled ? await FreeListing.countDocuments(filter) : listings.length;
    return res.json({
      success: true,
      listings,
      categories: LISTING_CATEGORIES,
      conditions: LISTING_CONDITIONS,
      pagination: enabled ? buildPaginationMeta({ page, limit, total, hasMore }) : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load free listings.");
  }
};

export const listMyFreeListings = async (req, res) => {
  try {
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 30,
      maxLimit: 100,
    });
    let query = FreeListing.find(makeFilter(req.query, req.user._id))
      .sort({ createdAt: -1 })
      .populate("seller", SELLER_CONTACT_FIELDS)
      .populate("community", "name")
      .populate("store", "name slug status")
      .populate("storeCategory", "name");
    query = enabled ? query.skip(skip).limit(limit + 1) : query.limit(200);
    const found = await query;
    const { rows, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };
    const { saved } = await getBookmarkMeta(
      "listing",
      rows.map((listing) => listing._id),
      req.user._id
    );
    return res.json({
      success: true,
      listings: await Promise.all(
        rows.map((listing) =>
          serialize(listing, req.user, saved[String(listing._id)] || false)
        )
      ),
      pagination: enabled
        ? buildPaginationMeta({
            page,
            limit,
            total: await FreeListing.countDocuments(makeFilter(req.query, req.user._id)),
            hasMore,
          })
        : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load your free listings.");
  }
};

export const getFreeListing = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    const flags = listing ? listingFlags(listing, req.user) : null;
    if (!listing || (listing.status !== "active" && !flags.isOwner && !flags.isAdmin)) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    const { saved } = await getBookmarkMeta("listing", [listing._id], req.user?._id);
    return res.json({
      success: true,
      listing: await serialize(listing, req.user, saved[String(listing._id)] || false),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load free listing.");
  }
};

export const createFreeListing = async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "other").toLowerCase();
    const condition = String(req.body.condition || "good").toLowerCase();
    const status = String(req.body.status || "active").toLowerCase();
    if (!title) return res.status(400).json({ success: false, message: "Listing title is required." });
    if (!LISTING_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category." });
    }
    if (!LISTING_CONDITIONS.includes(condition)) {
      return res.status(400).json({ success: false, message: "Invalid condition." });
    }
    if (!["active", "draft"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    if (await respondIfBanned(res, title, description)) return;
    const media = acceptSignedMediaList(
      req.user._id,
      Array.isArray(req.body.media) ? req.body.media : [],
      []
    );
    if (!media.ok) {
      return res.status(400).json({ success: false, message: media.message });
    }
    const seller = await User.findById(req.user._id).select("city state country").lean();
    const listing = await FreeListing.create({
      seller: req.user._id,
      title,
      description,
      price: 0,
      pricing: "free",
      category,
      condition,
      city: String(req.body.city || seller?.city || "").trim(),
      state: String(req.body.state || seller?.state || "").trim(),
      country: String(req.body.country || seller?.country || "").trim(),
      media: media.items,
      status,
    });
    await listing.populate("seller", SELLER_CONTACT_FIELDS);
    return res.status(201).json({
      success: true,
      message: "Free listing created.",
      listing: await serialize(listing, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to create free listing.");
  }
};

export const updateFreeListing = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id, true);
    if (!listing) return res.status(404).json({ success: false, message: "Free listing not found." });
    const flags = listingFlags(listing, req.user);
    if (!flags.canEdit && !flags.canChangeStatus) {
      return res.status(403).json({ success: false, message: "You cannot edit this free listing." });
    }
    const contentChanged = ["title", "description", "category", "condition", "city", "state", "country", "media"]
      .some((field) => req.body[field] !== undefined);
    if (!flags.canEdit && contentChanged) {
      return res.status(403).json({
        success: false,
        message: "Edit window expired. This listing is locked.",
        code: "EDIT_WINDOW_EXPIRED",
        editWindowMinutes: peekEditWindowMinutes(),
      });
    }
    if (flags.canEdit) {
      for (const field of ["title", "description", "city", "state", "country"]) {
        if (req.body[field] !== undefined) listing[field] = String(req.body[field] || "").trim();
      }
      for (const field of ["category", "condition"]) {
        if (req.body[field] === undefined) continue;
        const value = String(req.body[field] || "").toLowerCase();
        const options = field === "category" ? LISTING_CATEGORIES : LISTING_CONDITIONS;
        if (!options.includes(value)) {
          return res.status(400).json({ success: false, message: `Invalid ${field}.` });
        }
        listing[field] = value;
      }
      if (req.body.media !== undefined) {
        const media = acceptSignedMediaList(
          req.user._id,
          Array.isArray(req.body.media) ? req.body.media : [],
          listing.media || []
        );
        if (!media.ok) return res.status(400).json({ success: false, message: media.message });
        const keep = new Set(media.items.map((item) => item.url));
        const removed = (listing.media || []).map((item) => item.url).filter((url) => url && !keep.has(url));
        listing.media = media.items;
        if (removed.length) await destroyManyFromS3(removed);
      }
    }
    if (req.body.status !== undefined) {
      const status = String(req.body.status || "").toLowerCase();
      if (!LISTING_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status." });
      }
      if (!flags.canChangeStatus && status !== listing.status) {
        return res.status(403).json({ success: false, message: "You cannot change this listing status." });
      }
      if (["hidden", "removed"].includes(status) && !flags.isAdmin) {
        return res.status(403).json({ success: false, message: "You cannot set this listing status." });
      }
      listing.status = status;
      if (status === "sold" && !listing.soldAt) listing.soldAt = new Date();
      if (status === "active") {
        listing.soldAt = null;
        listing.removedAt = null;
        listing.removedBy = null;
        listing.hiddenAt = null;
        listing.hiddenReason = null;
      }
      if (status === "removed") {
        listing.removedAt = new Date();
        listing.removedBy = req.user._id;
      }
      if (status === "hidden") {
        listing.hiddenAt = new Date();
        listing.hiddenReason = "admin";
      }
    }
    if (!listing.title) return res.status(400).json({ success: false, message: "Listing title is required." });
    if (await respondIfBanned(res, listing.title, listing.description)) return;
    listing.price = 0;
    listing.pricing = "free";
    await listing.save();
    await listing.populate("seller", SELLER_CONTACT_FIELDS);
    return res.json({
      success: true,
      message: "Free listing updated.",
      listing: await serialize(listing, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update free listing.");
  }
};

export const markFreeListingSold = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id, true);
    if (!listing) return res.status(404).json({ success: false, message: "Free listing not found." });
    if (!listingFlags(listing, req.user).canMarkSold) {
      return res.status(403).json({ success: false, message: "You cannot mark this listing as sold." });
    }
    listing.status = "sold";
    listing.soldAt = new Date();
    await listing.save();
    return res.json({
      success: true,
      message: "Free listing marked as sold.",
      listing: await serialize(listing, req.user),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to mark free listing as sold.");
  }
};

export const deleteFreeListing = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: "Free listing not found." });
    if (!listingFlags(listing, req.user).canDelete) {
      return res.status(403).json({ success: false, message: "You cannot delete this free listing." });
    }
    const media = (listing.media || []).map((item) => item.url).filter(Boolean);
    await listing.deleteOne();
    if (media.length) await destroyManyFromS3(media);
    return res.json({ success: true, message: "Free listing deleted." });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete free listing.");
  }
};

export const contactFreeListingSeller = async (req, res) => {
  try {
    const listing = await findFreeListing(req.params.id);
    if (!listing || listing.status !== "active") {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    const sellerId = listing.seller?._id || listing.seller;
    if (String(sellerId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot contact yourself about your own listing." });
    }
    if (await isMessagingBlocked(req.user._id, sellerId)) {
      return res.status(403).json({ success: false, message: "You cannot message this user." });
    }
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ success: false, message: "Please include a message for the seller." });
    if (await respondIfBanned(res, message)) return;
    const listingSnapshot = formatListingSnapshot(listing);
    const conversation = await getOrCreateConversation(req.user._id, sellerId, { listingSnapshot });
    const { message: directMessage } = await sendDirectMessage({
      conversation,
      author: req.user,
      text: message,
      listingSnapshot,
      io: req.app.get("io"),
    });
    return res.json({
      success: true,
      message: "Your message was sent to the seller.",
      conversationId: conversation._id,
      directMessage,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to contact free listing seller.");
  }
};

export const resolveFreeListingCode = async (req, res) => {
  try {
    const listing = await FreeListing.findOne({
      shortCode: String(req.params.code || "").toLowerCase(),
    }).select("_id shortCode status seller").lean();
    if (!listing) return res.status(404).json({ success: false, message: "Free listing not found." });
    const isOwner = req.user && String(listing.seller) === String(req.user._id);
    if (
      listing.status !== "active" &&
      !isOwner &&
      !hasFreeListingsAdminPower(req.user)
    ) {
      return res.status(404).json({ success: false, message: "Free listing not found." });
    }
    return res.json({ success: true, id: listing._id, shortCode: listing.shortCode });
  } catch (error) {
    return sendServerError(res, error, "Failed to resolve free listing.");
  }
};
