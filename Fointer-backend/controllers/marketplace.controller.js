import Listing, {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "../models/listing.js";
import User from "../models/user.js";
import {
  parsePagination,
  resolveSort,
  buildPaginationMeta,
  takePage,
} from "../utils/pagination.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import {
  getOrCreateConversation,
  sendDirectMessage,
  formatListingSnapshot,
} from "./conversation.controller.js";
import {
  acceptSignedMediaList,
  destroyManyFromCloudinary,
} from "../utils/cloudinary.js";

const LISTING_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-asc": { price: 1, createdAt: -1 },
  "price-desc": { price: -1, createdAt: -1 },
};

const formatUser = (user, { includeContact = false } = {}) => {
  if (!user || typeof user !== "object" || !user._id) {
    return { id: user };
  }
  const payload = {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
  };
  if (includeContact) {
    payload.phone = user.phone || "";
    payload.email = user.email || "";
  }
  return payload;
};

const formatMedia = (media = []) =>
  media.map((m) => ({
    url: m.url,
    publicId: m.publicId || "",
    type: m.type,
  }));

export const formatListing = (listing, extras = {}) => ({
  id: listing._id,
  shortCode: listing.shortCode || "",
  title: listing.title,
  description: listing.description || "",
  price: listing.price,
  currency: listing.currency || "USD",
  category: listing.category,
  condition: listing.condition,
  city: listing.city || "",
  state: listing.state || "",
  country: listing.country || "",
  media: formatMedia(listing.media),
  status: listing.status,
  soldAt: listing.soldAt || null,
  seller: formatUser(listing.seller, {
    includeContact: extras.includeSellerContact ?? false,
  }),
  isOwner: extras.isOwner ?? false,
  canEdit: extras.canEdit ?? false,
  canDelete: extras.canDelete ?? false,
  canMarkSold: extras.canMarkSold ?? false,
  createdAt: listing.createdAt,
  updatedAt: listing.updatedAt,
});

export const findListingByParam = async (param) => {
  const id = await resolveDocumentId(Listing, param);
  if (!id) return null;
  return Listing.findById(id).populate(
    "seller",
    "username name avatar city state country phone email"
  );
};

const buildListingFlags = (listing, user) => {
  const isOwner =
    Boolean(user) &&
    String(listing.seller?._id || listing.seller) === String(user._id);
  const isAdmin = user?.role === "admin";
  return {
    isOwner,
    isAdmin,
    canEdit: isOwner || isAdmin,
    canDelete: isOwner || isAdmin,
    canMarkSold: isOwner && listing.status === "active" && !listing.removedBy,
    includeSellerContact: isOwner || isAdmin,
  };
};

const SELLER_EDITABLE_STATUSES = new Set(["active", "sold", "draft"]);

const validateListingStatusChange = (listing, nextStatus, user) => {
  const isAdmin = user?.role === "admin";
  if (isAdmin) return null;

  if (!SELLER_EDITABLE_STATUSES.has(nextStatus)) {
    return "You cannot set this listing status.";
  }

  if (listing.removedBy) {
    return "This listing was removed by moderation and cannot be reactivated.";
  }

  if (listing.status === "removed") {
    return "Removed listings cannot be changed by the seller.";
  }

  return null;
};

const buildBrowseFilter = (query = {}, { mine = false, userId = null } = {}) => {
  const filter = {};

  if (mine) {
    filter.seller = userId;
  } else {
    filter.status = "active";
  }

  const status = String(query.status || "").trim().toLowerCase();
  if (mine && status && LISTING_STATUSES.includes(status)) {
    filter.status = status;
  }

  const category = String(query.category || "").trim().toLowerCase();
  if (category && LISTING_CATEGORIES.includes(category)) {
    filter.category = category;
  }

  const q = String(query.q || "").trim();
  if (q) {
    filter.$or = [
      { title: { $regex: escapeRegex(q), $options: "i" } },
      { description: { $regex: escapeRegex(q), $options: "i" } },
    ];
  }

  const minPrice = query.minPrice != null ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice != null ? Number(query.maxPrice) : null;
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.price = {};
    if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
  }

  const city = String(query.city || "").trim();
  if (city) {
    filter.city = { $regex: escapeRegex(city), $options: "i" };
  }

  return filter;
};

const applyActiveSellerFilter = async (filter) => {
  const inactiveSellers = await User.find({
    status: { $ne: "active" },
  })
    .select("_id")
    .lean();
  if (!inactiveSellers.length) return filter;
  const inactiveIds = inactiveSellers.map((u) => u._id);
  if (filter.seller && !filter.seller.$in && !filter.seller.$nin) {
    return filter;
  }
  filter.seller = { ...(filter.seller || {}), $nin: inactiveIds };
  return filter;
};

export const listListings = async (req, res) => {
  try {
    const { page, limit, skip, enabled } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const sort = resolveSort(req.query.sort, LISTING_SORT_MAP, {
      createdAt: -1,
    });
    const filter = buildBrowseFilter(req.query);
    if (!req.query.mine) {
      await applyActiveSellerFilter(filter);
    }

    const query = Listing.find(filter)
      .sort(sort)
      .populate("seller", "username name avatar city state country");

    if (enabled) {
      query.skip(skip).limit(limit + 1);
    } else {
      query.limit(100);
    }

    const rows = await query.lean({ virtuals: false });
    const { rows: pageRows, hasMore } = enabled
      ? takePage(rows, limit)
      : { rows, hasMore: false };

    const listings = pageRows.map((listing) => {
      const flags = buildListingFlags(listing, req.user);
      return formatListing(listing, flags);
    });

    const total = enabled
      ? await Listing.countDocuments(filter)
      : listings.length;

    return res.json({
      success: true,
      listings,
      categories: LISTING_CATEGORIES,
      conditions: LISTING_CONDITIONS,
      pagination: enabled
        ? buildPaginationMeta({ page, limit, total, hasMore })
        : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list marketplace listings.");
  }
};

export const listMyListings = async (req, res) => {
  try {
    const filter = buildBrowseFilter(req.query, {
      mine: true,
      userId: req.user._id,
    });

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .populate("seller", "username name avatar city state country phone email");

    return res.json({
      success: true,
      listings: listings.map((listing) => {
        const flags = buildListingFlags(listing, req.user);
        return formatListing(listing, flags);
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load your listings.");
  }
};

export const getListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const flags = buildListingFlags(listing, req.user);
    const isOwner = flags.isOwner;
    const isAdmin = req.user?.role === "admin";

    if (listing.status !== "active" && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    return res.json({
      success: true,
      listing: formatListing(listing, flags),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load listing.");
  }
};

export const createListing = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      currency,
      category,
      condition,
      city,
      state,
      country,
      media,
      status,
    } = req.body;

    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Listing title is required.",
      });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid price is required.",
      });
    }

    const cleanCategory = String(category || "other").toLowerCase();
    if (!LISTING_CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category.",
      });
    }

    const cleanCondition = String(condition || "good").toLowerCase();
    if (!LISTING_CONDITIONS.includes(cleanCondition)) {
      return res.status(400).json({
        success: false,
        message: "Invalid condition.",
      });
    }

    const cleanStatus = String(status || "active").toLowerCase();
    if (!LISTING_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }
    if (cleanStatus === "removed" && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You cannot create a listing as removed.",
      });
    }

    const mediaList = Array.isArray(media) ? media : [];
    const acceptedMedia = acceptSignedMediaList(req.user._id, mediaList, []);
    if (!acceptedMedia.ok) {
      return res.status(400).json({
        success: false,
        message: acceptedMedia.message,
      });
    }

    const cleanDescription = String(description || "").trim();
    if (await respondIfBanned(res, cleanTitle, cleanDescription)) return;

    const seller = await User.findById(req.user._id)
      .select("city state country")
      .lean();

    const listing = await Listing.create({
      seller: req.user._id,
      title: cleanTitle,
      description: cleanDescription,
      price: numericPrice,
      currency: String(currency || "USD").trim().toUpperCase().slice(0, 3) || "USD",
      category: cleanCategory,
      condition: cleanCondition,
      city: String(city || seller?.city || "").trim(),
      state: String(state || seller?.state || "").trim(),
      country: String(country || seller?.country || "").trim(),
      media: acceptedMedia.items,
      status: cleanStatus,
    });

    await listing.populate(
      "seller",
      "username name avatar city state country phone email"
    );

    const flags = buildListingFlags(listing, req.user);
    return res.status(201).json({
      success: true,
      message: "Listing created.",
      listing: formatListing(listing, flags),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to create listing.");
  }
};

export const updateListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const flags = buildListingFlags(listing, req.user);
    if (!flags.canEdit) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit this listing.",
      });
    }

    if (req.body.title !== undefined) {
      listing.title = String(req.body.title || "").trim();
    }
    if (req.body.description !== undefined) {
      listing.description = String(req.body.description || "").trim();
    }
    if (req.body.price !== undefined) {
      const numericPrice = Number(req.body.price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "A valid price is required.",
        });
      }
      listing.price = numericPrice;
    }
    if (req.body.currency !== undefined) {
      listing.currency =
        String(req.body.currency || "USD").trim().toUpperCase().slice(0, 3) ||
        "USD";
    }
    if (req.body.category !== undefined) {
      const cleanCategory = String(req.body.category || "").toLowerCase();
      if (!LISTING_CATEGORIES.includes(cleanCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category.",
        });
      }
      listing.category = cleanCategory;
    }
    if (req.body.condition !== undefined) {
      const cleanCondition = String(req.body.condition || "").toLowerCase();
      if (!LISTING_CONDITIONS.includes(cleanCondition)) {
        return res.status(400).json({
          success: false,
          message: "Invalid condition.",
        });
      }
      listing.condition = cleanCondition;
    }
    if (req.body.city !== undefined) {
      listing.city = String(req.body.city || "").trim();
    }
    if (req.body.state !== undefined) {
      listing.state = String(req.body.state || "").trim();
    }
    if (req.body.country !== undefined) {
      listing.country = String(req.body.country || "").trim();
    }
    if (req.body.status !== undefined) {
      const cleanStatus = String(req.body.status || "").toLowerCase();
      if (!LISTING_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status.",
        });
      }

      const statusError = validateListingStatusChange(
        listing,
        cleanStatus,
        req.user
      );
      if (statusError) {
        return res.status(403).json({
          success: false,
          message: statusError,
        });
      }

      listing.status = cleanStatus;
      if (cleanStatus === "sold" && !listing.soldAt) {
        listing.soldAt = new Date();
      }
      if (cleanStatus === "active") {
        listing.soldAt = null;
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

    if (!listing.title) {
      return res.status(400).json({
        success: false,
        message: "Listing title is required.",
      });
    }

    if (await respondIfBanned(res, listing.title, listing.description)) return;

    await listing.save();
    await listing.populate(
      "seller",
      "username name avatar city state country phone email"
    );

    return res.json({
      success: true,
      message: "Listing updated.",
      listing: formatListing(listing, buildListingFlags(listing, req.user)),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update listing.");
  }
};

export const markListingSold = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const flags = buildListingFlags(listing, req.user);
    if (!flags.canMarkSold) {
      return res.status(403).json({
        success: false,
        message: "You cannot mark this listing as sold.",
      });
    }

    listing.status = "sold";
    listing.soldAt = new Date();
    await listing.save();
    await listing.populate(
      "seller",
      "username name avatar city state country phone email"
    );

    return res.json({
      success: true,
      message: "Listing marked as sold.",
      listing: formatListing(listing, buildListingFlags(listing, req.user)),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to mark listing as sold.");
  }
};

export const deleteListing = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const flags = buildListingFlags(listing, req.user);
    if (!flags.canDelete) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this listing.",
      });
    }

    const mediaUrls = (listing.media || [])
      .map((item) => item.url)
      .filter(Boolean);
    await listing.deleteOne();
    if (mediaUrls.length) {
      await destroyManyFromCloudinary(mediaUrls);
    }

    return res.json({
      success: true,
      message: "Listing deleted.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete listing.");
  }
};

export const contactSeller = async (req, res) => {
  try {
    const listing = await findListingByParam(req.params.id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    if (listing.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This listing is no longer available.",
      });
    }

    const sellerId = listing.seller?._id || listing.seller;
    if (String(sellerId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot contact yourself about your own listing.",
      });
    }

    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Please include a message for the seller.",
      });
    }

    if (await respondIfBanned(res, message)) return;

    const listingSnapshot = formatListingSnapshot(listing);
    const conversation = await getOrCreateConversation(
      req.user._id,
      sellerId,
      { listingSnapshot }
    );

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
    return sendServerError(res, error, "Failed to contact seller.");
  }
};

export const resolveListingCode = async (req, res) => {
  try {
    const listing = await Listing.findOne({
      shortCode: String(req.params.code || "").toLowerCase(),
    })
      .select("_id shortCode status seller")
      .lean();

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const isOwner =
      req.user &&
      String(listing.seller) === String(req.user._id);
    const isAdmin = req.user?.role === "admin";

    if (listing.status !== "active" && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    return res.json({
      success: true,
      id: listing._id,
      shortCode: listing.shortCode,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to resolve listing.");
  }
};
