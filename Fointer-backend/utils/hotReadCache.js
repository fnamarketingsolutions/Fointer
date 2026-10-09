import Post from "../models/post.js";
import User from "../models/user.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunityJoinRequest from "../models/communityJoinRequest.js";
import Reaction from "../models/reaction.js";
import Reshare from "../models/reshare.js";
import Bookmark from "../models/bookmark.js";
import Listing from "../models/listing.js";
import SponsoredPlacement from "../models/sponsoredPlacement.js";
import LiveEvent from "../models/liveEvent.js";
import CommunityInvite from "../models/communityInvite.js";
import {
  getEditWindowMinutes,
  getEffectiveMemberRole,
} from "./communityPermissions.js";

const REFRESH_MS = 8_000;
const POST_LIMIT = 40;
const COMMUNITY_LIMIT = 24;
const LISTING_LIMIT = 48;

let snapshot = null;
let refreshing = null;
let timer = null;

const toId = (value) => (value == null ? "" : String(value));

const addToSetMap = (map, key, userId) => {
  const id = toId(key);
  if (!id) return;
  let bucket = map.get(id);
  if (!bucket) {
    bucket = new Set();
    map.set(id, bucket);
  }
  bucket.add(toId(userId));
};

const loadPosts = async () => {
  const found = await Post.aggregate([
    { $match: { openFeed: true, isArchived: false } },
    { $sort: { createdAt: -1 } },
    { $limit: POST_LIMIT },
    {
      $lookup: {
        from: User.collection.name,
        localField: "author",
        foreignField: "_id",
        pipeline: [{ $project: { username: 1, name: 1, avatar: 1, role: 1 } }],
        as: "author",
      },
    },
    {
      $lookup: {
        from: Community.collection.name,
        localField: "community",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              name: 1,
              coverImage: 1,
              shortCode: 1,
              type: 1,
              channel: 1,
            },
          },
        ],
        as: "community",
      },
    },
    {
      $set: {
        author: { $ifNull: [{ $arrayElemAt: ["$author", 0] }, null] },
        community: { $ifNull: [{ $arrayElemAt: ["$community", 0] }, null] },
      },
    },
  ]);

  return { posts: found };
};

const loadCommunities = async () => {
  const communities = await Community.find({ type: { $in: ["public", "private_request"] } })
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(COMMUNITY_LIMIT)
    .populate({ path: "owner", select: "username name email avatar" })
    .lean();
  return { communities };
};

const loadViewerMaps = async (postIds) => {
  const [likes, reshares, saves, memberships, pending] = await Promise.all([
    Reaction.find({ targetType: "post", targetId: { $in: postIds } })
      .select("targetId user")
      .lean(),
    Reshare.find({ post: { $in: postIds } }).select("post user").lean(),
    Bookmark.find({ targetType: "post", targetId: { $in: postIds } })
      .select("targetId user")
      .lean(),
    CommunityMember.find({ status: "active" })
      .select("user community role status moderatorExpiresAt")
      .lean(),
    CommunityJoinRequest.find({ status: "pending" })
      .select("user community")
      .lean(),
  ]);

  const likedBy = new Map();
  const resharedBy = new Map();
  const savedBy = new Map();
  for (const row of likes) addToSetMap(likedBy, row.targetId, row.user);
  for (const row of reshares) addToSetMap(resharedBy, row.post, row.user);
  for (const row of saves) addToSetMap(savedBy, row.targetId, row.user);

  const accessByUser = new Map();
  for (const row of memberships) {
    const userId = toId(row.user);
    if (!userId) continue;
    let access = accessByUser.get(userId);
    if (!access) {
      access = {
        joinedIdSet: new Set(),
        manageableIdSet: new Set(),
        roleByCommunity: new Map(),
      };
      accessByUser.set(userId, access);
    }
    const communityId = toId(row.community);
    access.joinedIdSet.add(communityId);
    const role = getEffectiveMemberRole(row) || "member";
    access.roleByCommunity.set(communityId, role);
    if (role === "owner" || role === "moderator") {
      access.manageableIdSet.add(communityId);
    }
  }

  const pendingByUser = new Map();
  for (const row of pending) addToSetMap(pendingByUser, row.user, row.community);

  return { likedBy, resharedBy, savedBy, accessByUser, pendingByUser };
};

const loadListings = async () => {
  const inactiveSellers = await User.find({ status: { $ne: "active" } })
    .select("_id")
    .lean();
  const inactiveIds = inactiveSellers.map((user) => user._id);
  const filter = { status: "active" };
  if (inactiveIds.length) filter.seller = { $nin: inactiveIds };

  const [found, listingTotal] = await Promise.all([
    Listing.find(filter)
      .sort({ createdAt: -1 })
      .limit(LISTING_LIMIT + 1)
      .populate("seller", "username name avatar city state country status")
      .populate("community", "name")
      .lean(),
    Listing.countDocuments(filter),
  ]);
  const listingHasMore = found.length > LISTING_LIMIT;
  const listings = listingHasMore ? found.slice(0, LISTING_LIMIT) : found;
  const ids = listings.map((row) => row._id);
  const now = new Date();
  const [placements, saves] = ids.length
    ? await Promise.all([
        SponsoredPlacement.find({
          listing: { $in: ids },
          status: "active",
          startsAt: { $lte: now },
          expiresAt: { $gt: now },
        })
          .sort({ "placement.top": -1, "placement.priority": -1, expiresAt: 1 })
          .lean(),
        Bookmark.find({ targetType: "listing", targetId: { $in: ids } })
          .select("targetId user")
          .lean(),
      ])
    : [[], []];

  const listingSavedBy = new Map();
  for (const row of saves) addToSetMap(listingSavedBy, row.targetId, row.user);

  const listingPlacements = placements.map((placement) => ({
    listingId: toId(placement.listing),
    communityId: placement.community ? toId(placement.community) : null,
    geo: placement.geo || null,
    sponsorship: {
      top: Boolean(placement.placement?.top),
      section: Boolean(placement.placement?.section),
      badge: Boolean(placement.placement?.badge),
      priority: Number(placement.placement?.priority) || 0,
      communityId: placement.community ? toId(placement.community) : null,
      expiresAt: placement.expiresAt,
    },
  }));

  return {
    listings,
    listingHasMore,
    listingTotal,
    listingSavedBy,
    listingPlacements,
  };
};

const loadAllCommunities = async () => {
  const allCommunities = await Community.find({})
    .populate({ path: "owner", select: "username name email avatar" })
    .lean();
  return { allCommunities };
};

const loadLiveEvents = async () => {
  const liveEvents = await LiveEvent.find({ status: "live" })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("community", "name shortCode coverImage owner type")
    .populate("host", "username name avatar")
    .lean();
  return { liveEvents };
};

const loadInvites = async () => {
  const invites = await CommunityInvite.find({})
    .populate("inviter", "username name email avatar")
    .populate("invitee", "username name email avatar")
    .populate({
      path: "community",
      populate: { path: "owner", select: "username name email avatar" },
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return { invites };
};

const loadSponsoredPlacements = async () => {
  const now = new Date();
  const placements = await SponsoredPlacement.find({
    status: "active",
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
  })
    .populate({
      path: "listing",
      populate: [
        { path: "seller", select: "username name avatar city state country status" },
        { path: "community", select: "name" },
      ],
    })
    .sort({ "placement.top": -1, "placement.priority": -1, expiresAt: 1 })
    .lean();
  const sponsoredPlacements = placements.filter(
    (placement) =>
      placement.listing &&
      placement.listing.status === "active" &&
      placement.listing.seller?.status === "active"
  );
  const ids = sponsoredPlacements.map((placement) => placement.listing._id);
  const saves = ids.length
    ? await Bookmark.find({ targetType: "listing", targetId: { $in: ids } })
        .select("targetId user")
        .lean()
    : [];
  return { sponsoredPlacements, sponsoredSaves: saves };
};

const refreshOnce = async () => {
  const [
    { posts },
    communitySnap,
    listingSnap,
    allCommunitySnap,
    liveSnap,
    inviteSnap,
    sponsoredSnap,
  ] = await Promise.all([
    loadPosts(),
    loadCommunities(),
    loadListings(),
    loadAllCommunities(),
    loadLiveEvents(),
    loadInvites(),
    loadSponsoredPlacements(),
    getEditWindowMinutes(),
  ]);
  const viewerMaps = await loadViewerMaps(posts.map((post) => post._id));
  for (const row of sponsoredSnap.sponsoredSaves) {
    addToSetMap(listingSnap.listingSavedBy, row.targetId, row.user);
  }
  snapshot = {
    posts,
    ...communitySnap,
    ...listingSnap,
    allCommunities: allCommunitySnap.allCommunities,
    liveEvents: liveSnap.liveEvents,
    invites: inviteSnap.invites,
    sponsoredPlacements: sponsoredSnap.sponsoredPlacements,
    ...viewerMaps,
    at: Date.now(),
  };
};

export const getHotSnapshot = () => snapshot;

export const refreshHotReads = () => {
  if (refreshing) return refreshing;
  refreshing = refreshOnce()
    .catch((error) => {
      console.error("Hot read cache refresh failed:", error?.message || error);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

export const startHotReadCache = () => {
  if (timer) return refreshHotReads();
  timer = setInterval(() => {
    refreshHotReads();
  }, REFRESH_MS);
  timer.unref?.();
  return refreshHotReads();
};
