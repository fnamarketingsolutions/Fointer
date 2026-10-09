import Listing, {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "../models/listing.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import SponsoredPlacement from "../models/sponsoredPlacement.js";
import { matchesSponsoredAudience } from "../utils/sponsoredTargeting.js";
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
import { isMessagingBlocked } from "./block.controller.js";
import {
  acceptSignedMediaList,
  destroyManyFromS3,
} from "../utils/s3.js";
import { hasMarketplaceAdminPower } from "../utils/adminAccess.js";
import { getBookmarkMeta } from "../utils/bookmarkHelpers.js";
import {
  canViewCommunity,
  getEditWindowMinutes,
  getMembership,
} from "../utils/communityPermissions.js";
import { formatUserRef } from "../utils/deletedUser.js";
import { getHotSnapshot, refreshHotReads } from "../utils/hotReadCache.js";

const LISTING_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-asc": { price: 1, createdAt: -1 },
  "price-desc": { price: -1, createdAt: -1 },
};

/** Never put phone/email here — only attach via SELLER_CONTACT_SELECT when allowed. */
const SELLER_PUBLIC_SELECT =
  "username name avatar city state country status";
const SELLER_CONTACT_SELECT =
  "username name avatar city state country phone email status";

const formatUser = (user, { includeContact = false } = {}) => {
  if (!user || typeof user !== "object" || !user._id) {
    return formatUserRef(user);
  }
  const payload = formatUserRef(user, {
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
  });
  if (user.status) {
    payload.status = user.status;
  }
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

const formatCommunity = (community) => {
  if (!community) return null;
  return {
    id: String(community._id || community),
    name: community.name || "",
  };
};

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
  community: formatCommunity(listing.community),
  media: formatMedia(listing.media),
  status: listing.status,
  hiddenAt: listing.hiddenAt || null,
  hiddenReason: listing.hiddenReason || null,
  soldAt: listing.soldAt || null,
  seller: formatUser(listing.seller, {
    includeContact: extras.includeSellerContact ?? false,
  }),
  isOwner: extras.isOwner ?? false,
  canEdit: extras.canEdit ?? false,
  canChangeStatus: extras.canChangeStatus ?? false,
  canDelete: extras.canDelete ?? false,
  isLocked: extras.isLocked ?? false,
  editWindowMinutes: extras.editWindowMinutes ?? null,
  canMarkSold: extras.canMarkSold ?? false,
  savedByMe: extras.savedByMe ?? false,
  isSponsored: Boolean(extras.sponsorship),
  sponsorship: extras.sponsorship || null,
  createdAt: listing.createdAt,
  updatedAt: listing.updatedAt,
});

export const findListingByParam = async (
  param,
  { includeSellerContact = false } = {}
) => {
  const id = await resolveDocumentId(Listing, param);
  if (!id) return null;
  // Public seller fields by default — phone/email only when explicitly requested
  // (owner/admin flows) so raw docs never carry contact for guests.
  return Listing.findById(id).populate(
    "seller",
    includeSellerContact ? SELLER_CONTACT_SELECT : SELLER_PUBLIC_SELECT
  );
};

const hydrateSellerContact = async (listing) => {
  if (!listing) return listing;
  await listing.populate("seller", SELLER_CONTACT_SELECT);
  return listing;
};

const isWithinWindow = (createdAt, minutes) => {
  if (!createdAt || minutes == null) return false;
  const windowMs = Math.max(1, Number(minutes) || 60) * 60 * 1000;
  return Date.now() - new Date(createdAt).getTime() < windowMs;
};

const buildListingFlags = (listing, user, editWindowMinutes = 60) => {
  const isOwner =
    Boolean(user) &&
    String(listing.seller?._id || listing.seller) === String(user._id);
  const isAdmin = hasMarketplaceAdminPower(user);
  const within = isWithinWindow(listing.createdAt, editWindowMinutes);
  const canEdit = isAdmin || (isOwner && within);
  return {
    isOwner,
    isAdmin,
    canEdit,
    // Status (active/sold/draft) stays editable for owners after the content lock.
    canChangeStatus:
      isAdmin ||
      (isOwner &&
        !listing.removedBy &&
        listing.status !== "removed" &&
        listing.status !== "hidden"),
    canDelete: isOwner || isAdmin,
    isLocked: Boolean(isOwner && !isAdmin && !within),
    editWindowMinutes,
    canMarkSold: isOwner && listing.status === "active" && !listing.removedBy,
    includeSellerContact: isOwner || isAdmin,
  };
};

const mediaFingerprint = (media) =>
  (Array.isArray(media) ? media : [])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return String(item?.url || "").trim();
    })
    .filter(Boolean)
    .join("\0");

/** True when the request tries to change listing content (not just status). */
const listingContentChanged = (listing, body = {}) => {
  if (
    body.title !== undefined &&
    String(body.title || "").trim() !== String(listing.title || "").trim()
  ) {
    return true;
  }
  if (
    body.description !== undefined &&
    String(body.description || "").trim() !==
      String(listing.description || "").trim()
  ) {
    return true;
  }
  if (
    body.price !== undefined &&
    Number(body.price) !== Number(listing.price)
  ) {
    return true;
  }
  if (
    body.currency !== undefined &&
    String(body.currency || "USD").trim().toUpperCase().slice(0, 3) !==
      String(listing.currency || "USD").trim().toUpperCase().slice(0, 3)
  ) {
    return true;
  }
  if (
    body.category !== undefined &&
    String(body.category || "").toLowerCase() !==
      String(listing.category || "").toLowerCase()
  ) {
    return true;
  }
  if (
    body.condition !== undefined &&
    String(body.condition || "").toLowerCase() !==
      String(listing.condition || "").toLowerCase()
  ) {
    return true;
  }
  if (
    body.city !== undefined &&
    String(body.city || "").trim() !== String(listing.city || "").trim()
  ) {
    return true;
  }
  if (
    body.state !== undefined &&
    String(body.state || "").trim() !== String(listing.state || "").trim()
  ) {
    return true;
  }
  if (
    body.country !== undefined &&
    String(body.country || "").trim() !== String(listing.country || "").trim()
  ) {
    return true;
  }
  if (
    body.media !== undefined &&
    mediaFingerprint(body.media) !== mediaFingerprint(listing.media)
  ) {
    return true;
  }
  return false;
};

const SELLER_EDITABLE_STATUSES = new Set(["active", "sold", "draft"]);

const validateListingStatusChange = (listing, nextStatus, user) => {
  if (hasMarketplaceAdminPower(user)) return null;

  if (!SELLER_EDITABLE_STATUSES.has(nextStatus)) {
    return "You cannot set this listing status.";
  }

  if (listing.removedBy) {
    return "This listing was removed by moderation and cannot be reactivated.";
  }

  if (listing.status === "removed") {
    return "Removed listings cannot be changed by the seller.";
  }

  if (listing.status === "hidden") {
    return "This listing is hidden while the seller account is restricted.";
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

  const communityId = String(query.communityId || "").trim();
  if (/^[a-f\d]{24}$/i.test(communityId)) {
    filter.community = communityId;
  }

  return filter;
};

const getViewerMemberCommunityIds = async (viewerId) => {
  if (!viewerId) return [];
  const rows = await CommunityMember.find({
    user: viewerId,
    status: "active",
  })
    .select("community")
    .lean();
  return rows.map((row) => row.community).filter(Boolean);
};

/**
 * Platform-wide boosts (community null) show to everyone.
 * Community-attributed boosts show only to members of that community
 * (or unrestricted when memberCommunityIds is null, e.g. seller's My listings).
 */
const getActiveSponsorships = async (
  listings,
  communityId = "",
  {
    includeCommunity = false,
    viewer = null,
    memberCommunityIds = null,
  } = {}
) => {
  if (!listings.length) return new Map();
  const now = new Date();

  let communityClause;
  if (communityId) {
    communityClause = { $in: [null, communityId] };
  } else if (!includeCommunity) {
    communityClause = null;
  } else if (Array.isArray(memberCommunityIds)) {
    communityClause = { $in: [null, ...memberCommunityIds] };
  } else {
    communityClause = undefined;
  }

  const placements = await SponsoredPlacement.find({
    listing: { $in: listings.map((listing) => listing._id) },
    status: "active",
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
    ...(communityClause === undefined ? {} : { community: communityClause }),
  })
    .sort({ "placement.top": -1, "placement.priority": -1, expiresAt: 1 })
    .lean();
  const byId = new Map();
  for (const placement of placements) {
    const listing = listings.find(
      (row) => String(row._id) === String(placement.listing)
    );
    if (!listing) continue;
    // Audience geo is seller-chosen at checkout; match viewer profile when available.
    if (!matchesSponsoredAudience(placement.geo, viewer)) continue;
    const key = String(placement.listing);
    if (byId.has(key)) continue;
    byId.set(key, {
      top: Boolean(placement.placement?.top),
      section: Boolean(placement.placement?.section),
      badge: Boolean(placement.placement?.badge),
      priority: Number(placement.placement?.priority) || 0,
      communityId: placement.community ? String(placement.community) : null,
      expiresAt: placement.expiresAt,
    });
  }
  return byId;
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
    const sortKey = String(req.query.sort || "newest").trim().toLowerCase();
    const hot = getHotSnapshot();
    const serveFromMemory =
      hot?.listings &&
      enabled &&
      page === 1 &&
      limit <= 48 &&
      (sortKey === "newest" || sortKey === "") &&
      !req.query.mine &&
      !String(req.query.category || "").trim() &&
      !String(req.query.q || "").trim() &&
      req.query.minPrice == null &&
      req.query.maxPrice == null &&
      !String(req.query.city || "").trim() &&
      !String(req.query.communityId || "").trim() &&
      String(req.query.sponsoredOnly || "").toLowerCase() !== "true" &&
      !hasMarketplaceAdminPower(req.user);

    const communityId = String(req.query.communityId || "").trim();
    const sponsoredFromMemory =
      Array.isArray(hot?.sponsoredPlacements) &&
      Array.isArray(hot?.allCommunities) &&
      String(req.query.sponsoredOnly || "").toLowerCase() === "true" &&
      /^[a-f\d]{24}$/i.test(communityId) &&
      enabled &&
      page === 1 &&
      limit <= 48 &&
      !req.query.mine &&
      !String(req.query.category || "").trim() &&
      !String(req.query.q || "").trim() &&
      req.query.minPrice == null &&
      req.query.maxPrice == null &&
      !String(req.query.city || "").trim() &&
      !hasMarketplaceAdminPower(req.user);

    if (sponsoredFromMemory) {
      const community = hot.allCommunities.find(
        (row) => String(row._id) === communityId
      );
      const viewerKey = req.user?._id ? String(req.user._id) : "";
      const membership = community
        ? {
            status: "active",
            role: hot.accessByUser
              .get(viewerKey)
              ?.roleByCommunity?.get(communityId),
          }
        : null;
      const memberRole = membership?.role ? membership : null;
      if (
        community &&
        canViewCommunity(community, req.user, memberRole)
      ) {
        const seen = new Set();
        const rows = [];
        for (const placement of hot.sponsoredPlacements) {
          if (String(placement.community) !== communityId) continue;
          if (!matchesSponsoredAudience(placement.geo, req.user)) continue;
          const listing = placement.listing;
          const listingId = String(listing?._id || "");
          if (!listingId || seen.has(listingId)) continue;
          seen.add(listingId);
          rows.push({ listing, placement });
        }
        const pageRows = rows.slice(0, limit);
        const editWindowMinutes = req.user ? await getEditWindowMinutes() : null;
        return res.json({
          success: true,
          listings: pageRows.map(({ listing, placement }) => {
            const flags = buildListingFlags(listing, req.user, editWindowMinutes);
            return formatListing(listing, {
              ...flags,
              savedByMe: Boolean(
                viewerKey && hot.listingSavedBy.get(String(listing._id))?.has(viewerKey)
              ),
              sponsorship: {
                top: Boolean(placement.placement?.top),
                section: Boolean(placement.placement?.section),
                badge: Boolean(placement.placement?.badge),
                priority: Number(placement.placement?.priority) || 0,
                communityId,
                expiresAt: placement.expiresAt,
              },
            });
          }),
          categories: LISTING_CATEGORIES,
          conditions: LISTING_CONDITIONS,
          pagination: buildPaginationMeta({
            page,
            limit,
            total: rows.length,
            hasMore: rows.length > limit,
          }),
        });
      }
    }

    if (serveFromMemory) {
      const viewerKey = req.user?._id ? String(req.user._id) : "";
      const joined = viewerKey
        ? hot.accessByUser.get(viewerKey)?.joinedIdSet || new Set()
        : new Set();
      const pageRows = hot.listings.slice(0, limit);
      const sponsorships = new Map();
      for (const placement of hot.listingPlacements || []) {
        if (!pageRows.some((row) => String(row._id) === placement.listingId)) {
          continue;
        }
        if (placement.communityId && !joined.has(placement.communityId)) continue;
        if (!matchesSponsoredAudience(placement.geo, req.user)) continue;
        if (sponsorships.has(placement.listingId)) continue;
        sponsorships.set(placement.listingId, placement.sponsorship);
      }
      const ordered = pageRows.slice().sort((left, right) => {
        const a = sponsorships.get(String(left._id));
        const b = sponsorships.get(String(right._id));
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        if (a.top !== b.top) return a.top ? -1 : 1;
        return b.priority - a.priority;
      });
      const saved = {};
      for (const listing of ordered) {
        const id = String(listing._id);
        saved[id] = Boolean(viewerKey && hot.listingSavedBy.get(id)?.has(viewerKey));
      }
      const editWindowMinutes = req.user ? await getEditWindowMinutes() : null;
      return res.json({
        success: true,
        listings: ordered.map((listing) => {
          const flags = buildListingFlags(listing, req.user, editWindowMinutes);
          return formatListing(listing, {
            ...flags,
            savedByMe: saved[String(listing._id)] || false,
            sponsorship: sponsorships.get(String(listing._id)) || null,
          });
        }),
        categories: LISTING_CATEGORIES,
        conditions: LISTING_CONDITIONS,
        pagination: buildPaginationMeta({
          page,
          limit,
          total: hot.listingTotal,
          hasMore: hot.listings.length > limit || hot.listingHasMore,
        }),
      });
    }

    const sort = resolveSort(req.query.sort, LISTING_SORT_MAP, {
      createdAt: -1,
    });
    const filter = buildBrowseFilter(req.query);
    if (String(req.query.sponsoredOnly || "").toLowerCase() === "true") {
      const communityId = String(req.query.communityId || "").trim();
      if (!/^[a-f\d]{24}$/i.test(communityId)) {
        return res.status(400).json({
          success: false,
          message: "A valid community is required for sponsored listings.",
        });
      }
      const community = await Community.findById(communityId).lean();
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found.",
        });
      }
      const membership = req.user
        ? await getMembership(communityId, req.user._id)
        : null;
      if (!canViewCommunity(community, req.user, membership)) {
        return res.status(403).json({
          success: false,
          message: "You cannot view sponsored listings in this community.",
        });
      }
      const now = new Date();
      const placements = await SponsoredPlacement.find({
        community: communityId,
        status: "active",
        startsAt: { $lte: now },
        expiresAt: { $gt: now },
      })
        .populate("listing")
        .lean();
      const sponsoredListingIds = placements
        .filter(
          (placement) =>
            placement.listing?.status === "active" &&
            matchesSponsoredAudience(placement.geo, req.user)
        )
        .map((placement) => placement.listing._id);
      delete filter.community;
      filter._id = { $in: sponsoredListingIds };
    }
    if (!req.query.mine) {
      await applyActiveSellerFilter(filter);
    }

    const query = Listing.find(filter)
      .sort(sort)
      .populate("seller", SELLER_PUBLIC_SELECT)
      .populate("community", "name");

    if (enabled) {
      query.skip(skip).limit(limit + 1);
    } else {
      query.limit(100);
    }

    const rows = await query.lean({ virtuals: false });
    const { rows: pageRows, hasMore } = enabled
      ? takePage(rows, limit)
      : { rows, hasMore: false };

    const scopedCommunityId = String(req.query.communityId || "").trim();
    const memberCommunityIds = scopedCommunityId
      ? null
      : await getViewerMemberCommunityIds(req.user?._id);
    const sponsorships = await getActiveSponsorships(
      pageRows,
      scopedCommunityId,
      {
        // Main marketplace: platform boosts + community boosts for communities the viewer belongs to.
        includeCommunity: !scopedCommunityId,
        viewer: req.user,
        memberCommunityIds: scopedCommunityId ? null : memberCommunityIds,
      }
    );
    pageRows.sort((left, right) => {
      const a = sponsorships.get(String(left._id));
      const b = sponsorships.get(String(right._id));
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      if (a.top !== b.top) return a.top ? -1 : 1;
      return b.priority - a.priority;
    });

    const { saved } = await getBookmarkMeta(
      "listing",
      pageRows.map((row) => row._id),
      req.user?._id
    );

    const editWindowMinutes = await getEditWindowMinutes();
    const listings = pageRows.map((listing) => {
      const flags = buildListingFlags(listing, req.user, editWindowMinutes);
      return formatListing(listing, {
        ...flags,
        savedByMe: saved[String(listing._id)] || false,
        sponsorship: sponsorships.get(String(listing._id)) || null,
      });
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
      .populate("seller", SELLER_CONTACT_SELECT)
      .populate("community", "name")
      .lean();

    // Sellers see all of their own boosts (platform + any community attribution).
    const sponsorships = await getActiveSponsorships(listings, "", {
      includeCommunity: true,
      viewer: req.user,
      memberCommunityIds: null,
    });
    const { saved } = await getBookmarkMeta(
      "listing",
      listings.map((row) => row._id),
      req.user._id
    );

    const editWindowMinutes = await getEditWindowMinutes();
    return res.json({
      success: true,
      listings: listings.map((listing) => {
        const flags = buildListingFlags(listing, req.user, editWindowMinutes);
        return formatListing(listing, {
          ...flags,
          savedByMe: saved[String(listing._id)] || false,
          sponsorship: sponsorships.get(String(listing._id)) || null,
        });
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load your listings.");
  }
};

const sponsorshipForViewer = (
  placements,
  { viewer, isOwner, scopedCommunityId, joined }
) => {
  for (const placement of placements) {
    const communityId = placement.communityId ?? (
      placement.community ? String(placement.community) : null
    );
    const sponsorship = placement.sponsorship || {
      top: Boolean(placement.placement?.top),
      section: Boolean(placement.placement?.section),
      badge: Boolean(placement.placement?.badge),
      priority: Number(placement.placement?.priority) || 0,
      communityId,
      expiresAt: placement.expiresAt,
    };
    if (scopedCommunityId) {
      if (communityId && communityId !== scopedCommunityId) continue;
    } else if (!isOwner && communityId && !joined.has(communityId)) {
      continue;
    }
    if (!matchesSponsoredAudience(placement.geo, viewer)) continue;
    return sponsorship;
  }
  return null;
};

const cachedListing = (hot, param) => {
  const raw = String(param || "").trim();
  if (!raw || !hot?.listings?.length) return null;
  const code = raw.toLowerCase();
  return (
    hot.listings.find(
      (row) => String(row._id) === raw || String(row.shortCode || "") === code
    ) || null
  );
};

export const getListing = async (req, res) => {
  try {
    const param = String(req.params.id || "").trim();
    const hot = getHotSnapshot();
    const cached = cachedListing(hot, param);
    const sellerId = String(cached?.seller?._id || cached?.seller || "");
    const viewerIsOwner = Boolean(req.user?._id) && sellerId === String(req.user._id);

    if (cached && !viewerIsOwner && !hasMarketplaceAdminPower(req.user)) {
      const viewerKey = req.user?._id ? String(req.user._id) : "";
      const joined = viewerKey
        ? hot.accessByUser.get(viewerKey)?.joinedIdSet || new Set()
        : new Set();
      const scopedCommunityId = String(req.query.communityId || "").trim();
      const editWindowMinutes = req.user ? await getEditWindowMinutes() : null;
      const flags = buildListingFlags(cached, req.user, editWindowMinutes);
      const listingId = String(cached._id);
      return res.json({
        success: true,
        listing: formatListing(cached, {
          ...flags,
          savedByMe: Boolean(
            viewerKey && hot.listingSavedBy.get(listingId)?.has(viewerKey)
          ),
          sponsorship: sponsorshipForViewer(
            (hot.listingPlacements || []).filter(
              (placement) => placement.listingId === listingId
            ),
            {
              viewer: req.user,
              isOwner: flags.isOwner,
              scopedCommunityId,
              joined,
            }
          ),
        }),
      });
    }

    const id = await resolveDocumentId(Listing, param);
    if (!id) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const viewerId = req.user?._id || null;
    const now = new Date();
    const scopedCommunityId = String(req.query.communityId || "").trim();
    const [found, editWindowMinutes, memberRows, placements, savedMeta] =
      await Promise.all([
        Listing.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: User.collection.name,
              localField: "seller",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    name: 1,
                    avatar: 1,
                    city: 1,
                    state: 1,
                    country: 1,
                    status: 1,
                    phone: 1,
                    email: 1,
                    role: 1,
                  },
                },
              ],
              as: "seller",
            },
          },
          {
            $lookup: {
              from: Community.collection.name,
              localField: "community",
              foreignField: "_id",
              pipeline: [{ $project: { name: 1 } }],
              as: "community",
            },
          },
          {
            $set: {
              seller: { $ifNull: [{ $arrayElemAt: ["$seller", 0] }, null] },
              community: {
                $ifNull: [{ $arrayElemAt: ["$community", 0] }, null],
              },
            },
          },
        ]),
        getEditWindowMinutes(),
        viewerId && !hot
          ? CommunityMember.find({ user: viewerId, status: "active" })
              .select("community")
              .lean()
          : Promise.resolve(null),
        SponsoredPlacement.find({
          listing: id,
          status: "active",
          startsAt: { $lte: now },
          expiresAt: { $gt: now },
        })
          .sort({ "placement.top": -1, "placement.priority": -1, expiresAt: 1 })
          .lean(),
        viewerId
          ? getBookmarkMeta("listing", [id], viewerId)
          : Promise.resolve({ saved: {} }),
      ]);

    const listing = found[0];
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const flags = buildListingFlags(listing, req.user, editWindowMinutes);
    if (listing.status !== "active" && !flags.isOwner && !flags.isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Listing not found.",
      });
    }

    const joined =
      hot && viewerId
        ? hot.accessByUser.get(String(viewerId))?.joinedIdSet || new Set()
        : new Set((memberRows || []).map((row) => String(row.community)));

    return res.json({
      success: true,
      listing: formatListing(listing, {
        ...flags,
        savedByMe: savedMeta.saved[String(listing._id)] || false,
        sponsorship: sponsorshipForViewer(placements, {
          viewer: req.user,
          isOwner: flags.isOwner,
          scopedCommunityId,
          joined,
        }),
      }),
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
    if (
      (cleanStatus === "removed" || cleanStatus === "hidden") &&
      !hasMarketplaceAdminPower(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot create a listing with that status.",
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

    await hydrateSellerContact(listing);
    refreshHotReads();

    const flags = buildListingFlags(
      listing,
      req.user,
      await getEditWindowMinutes()
    );
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

    const editWindowMinutes = await getEditWindowMinutes();
    const flags = buildListingFlags(listing, req.user, editWindowMinutes);
    if (!flags.canEdit && !flags.canChangeStatus) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit this listing.",
      });
    }

    const wantsContentEdit = listingContentChanged(listing, req.body);
    if (!flags.canEdit && wantsContentEdit) {
      return res.status(403).json({
        success: false,
        message: flags.isOwner
          ? "Edit window expired. This listing is locked."
          : "You cannot edit this listing.",
        editWindowMinutes,
        code: flags.isOwner ? "EDIT_WINDOW_EXPIRED" : undefined,
      });
    }

    if (flags.canEdit) {
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
    if (flags.canEdit && req.body.media !== undefined) {
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
        await destroyManyFromS3(removed);
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
    const responseFlags = buildListingFlags(
      listing,
      req.user,
      editWindowMinutes
    );
    if (responseFlags.includeSellerContact) {
      await hydrateSellerContact(listing);
    }
    refreshHotReads();

    return res.json({
      success: true,
      message: "Listing updated.",
      listing: formatListing(listing, responseFlags),
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

    const flags = buildListingFlags(
      listing,
      req.user,
      await getEditWindowMinutes()
    );
    if (!flags.canMarkSold) {
      return res.status(403).json({
        success: false,
        message: "You cannot mark this listing as sold.",
      });
    }

    listing.status = "sold";
    listing.soldAt = new Date();
    await listing.save();
    refreshHotReads();
    if (flags.includeSellerContact) {
      await hydrateSellerContact(listing);
    }

    return res.json({
      success: true,
      message: "Listing marked as sold.",
      listing: formatListing(listing, flags),
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

    const flags = buildListingFlags(
      listing,
      req.user,
      await getEditWindowMinutes()
    );
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
    refreshHotReads();
    if (mediaUrls.length) {
      await destroyManyFromS3(mediaUrls);
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

    if (await isMessagingBlocked(req.user._id, sellerId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user.",
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
    const isAdmin = hasMarketplaceAdminPower(req.user);

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