import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
import Reshare from "../models/reshare.js";
import Bookmark from "../models/bookmark.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import User from "../models/user.js";
import {
  canEngageInCommunity,
  canManagePostsInCommunity,
  OPEN_FEED_COMMUNITY_TYPES,
  isWithinEditWindow,
  getEditWindowMinutes,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";
import { hasContentAdminPower } from "../utils/adminAccess.js";
import {
  parsePagination,
  resolveSort,
  buildPaginationMeta,
  takePage,
} from "../utils/pagination.js";
import { parseObjectIdInput, resolveDocumentId } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { notify, personName, snippet } from "../utils/notify.js";
import { getFollowedUserIds } from "../utils/followHelpers.js";
import { getBookmarkMeta } from "../utils/bookmarkHelpers.js";
import {
  acceptSignedMediaList,
  destroyManyFromS3,
} from "../utils/s3.js";
import { formatUserRef } from "../utils/deletedUser.js";
import { getHotSnapshot, refreshHotReads } from "../utils/hotReadCache.js";

const POST_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

const formatUser = (user) =>
  formatUserRef(user, { role: user?.role || "user" });

const formatMedia = (media = []) =>
  media.map((m) => ({
    url: m.url,
    publicId: m.publicId || "",
    type: m.type,
  }));

const getLikeMeta = async (targetType, targetIds, userId) => {
  const liked = {};
  for (const id of targetIds) {
    liked[String(id)] = false;
  }

  if (!targetIds.length || !userId) {
    return { liked };
  }

  // Only load the current user's reactions (counts live on Post/Comment docs).
  const mine = await Reaction.find({
    targetType,
    targetId: { $in: targetIds },
    user: userId,
  })
    .select("targetId")
    .lean();

  for (const r of mine) {
    liked[String(r.targetId)] = true;
  }

  return { liked };
};

const getReshareMeta = async (postIds, userId) => {
  const reshared = {};
  for (const id of postIds) {
    reshared[String(id)] = false;
  }

  if (!postIds.length || !userId) {
    return { reshared };
  }

  const mine = await Reshare.find({
    post: { $in: postIds },
    user: userId,
  })
    .select("post")
    .lean();

  for (const row of mine) {
    reshared[String(row.post)] = true;
  }

  return { reshared };
};

const getViewerEngagement = async (postIds, userId) => {
  const [likeMeta, reshareMeta, bookmarkMeta] = await Promise.all([
    getLikeMeta("post", postIds, userId),
    getReshareMeta(postIds, userId),
    getBookmarkMeta("post", postIds, userId),
  ]);
  return {
    liked: likeMeta.liked,
    reshared: reshareMeta.reshared,
    saved: bookmarkMeta.saved,
  };
};

const isWithinWindow = (createdAt, minutes) => {
  if (!createdAt || minutes == null) return false;
  return Date.now() - new Date(createdAt).getTime() < minutes * 60 * 1000;
};

const getViewerCommunityAccess = async (user) => {
  if (!user) {
    return {
      joinedIds: [],
      joinedIdSet: new Set(),
      manageableIdSet: new Set(),
    };
  }

  if (hasContentAdminPower(user)) {
    const all = await Community.find().select("_id").lean();
    const ids = all.map((row) => row._id);
    const idSet = new Set(ids.map(String));
    return { joinedIds: ids, joinedIdSet: idSet, manageableIdSet: idSet };
  }

  const memberships = await CommunityMember.find({
    user: user._id,
    status: "active",
  })
    .select("community role status moderatorExpiresAt")
    .lean();

  const joinedIds = memberships.map((row) => row.community);
  const joinedIdSet = new Set(joinedIds.map(String));
  const manageableIdSet = new Set();
  for (const row of memberships) {
    const role = getEffectiveMemberRole(row);
    if (role === "owner" || role === "moderator") {
      manageableIdSet.add(String(row.community));
    }
  }

  return { joinedIds, joinedIdSet, manageableIdSet };
};

const formatFeedPost = (
  post,
  user,
  {
    liked = {},
    reshared = {},
    saved = {},
    joinedIdSet,
    manageableIdSet,
    editWindowMinutes,
  }
) => {
  if (!user) {
    return formatPost(post, {
      likeCount: post.likeCount ?? 0,
      likedByMe: false,
      commentCount: post.commentCount ?? 0,
      reshareCount: post.reshareCount ?? 0,
      resharedByMe: false,
      savedByMe: false,
      canEngage: false,
    });
  }

  const isAuthor = isDocAuthor(post, user);
  const isAdmin = hasContentAdminPower(user);
  const within = isWithinWindow(post.createdAt, editWindowMinutes);
  const communityId = post.community?._id || post.community;
  const communityKey = communityId ? String(communityId) : null;

  return formatPost(post, {
    likeCount: post.likeCount ?? 0,
    likedByMe: liked[String(post._id)] || false,
    commentCount: post.commentCount ?? 0,
    reshareCount: post.reshareCount ?? 0,
    resharedByMe: reshared[String(post._id)] || false,
    savedByMe: saved[String(post._id)] || false,
    isAuthor,
    canEdit: isAdmin || (isAuthor && within && !post.isArchived),
    isLocked: !isAdmin && isAuthor && !within && !post.isArchived,
    canDelete:
      isAdmin ||
      (isAuthor && Boolean(post.isArchived)) ||
      (communityKey ? manageableIdSet.has(communityKey) : false),
    canEngage:
      !post.isArchived &&
      (isAdmin || !communityKey || joinedIdSet.has(communityKey)),
    editWindowMinutes,
  });
};

const postListSort = (sortBy) =>
  sortBy === "likes"
    ? { likeCount: -1, createdAt: -1 }
    : sortBy === "comments"
      ? { commentCount: -1, createdAt: -1 }
      : resolveSort(sortBy, POST_SORT_MAP, { createdAt: -1 });

const clampNonNegative = async (Model, id, field) => {
  await Model.updateOne(
    { _id: id, [field]: { $lt: 0 } },
    { $set: { [field]: 0 } }
  );
};

const formatPost = (post, extras = {}) => {
  const community = post.community;
  let communityPayload = null;
  if (community && typeof community === "object" && community._id) {
    communityPayload = {
      id: community._id,
      shortCode: community.shortCode || "",
      name: community.name,
      coverImage: community.coverImage || "",
      type: community.type || "",
      channel: community.channel || "",
    };
  } else if (community) {
    communityPayload = { id: community };
  }

  return {
    id: post._id,
    shortCode: post.shortCode || "",
    title: post.title || "",
    text: post.text || "",
    media: formatMedia(post.media),
    community: communityPayload,
    author: formatUser(post.author),
    likeCount: extras.likeCount ?? post.likeCount ?? 0,
    likedByMe: extras.likedByMe ?? false,
    commentCount: extras.commentCount ?? post.commentCount ?? 0,
    reshareCount: extras.reshareCount ?? post.reshareCount ?? 0,
    resharedByMe: extras.resharedByMe ?? false,
    savedByMe: extras.savedByMe ?? false,
    canEdit: extras.canEdit ?? false,
    canDelete: extras.canDelete ?? false,
    canArchive:
      extras.canArchive ?? Boolean(extras.isAuthor && !post.isArchived),
    isArchived: Boolean(post.isArchived),
    archivedAt: post.archivedAt || null,
    canEngage: extras.canEngage ?? false,
    isAuthor: extras.isAuthor ?? false,
    isLocked: extras.isLocked ?? false,
    editWindowMinutes: extras.editWindowMinutes ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const OPEN_FEED_CACHE_MS = 15_000;
let openFeedIdsCache = { ids: null, at: 0 };

const getOpenFeedCommunityIds = async () => {
  if (
    openFeedIdsCache.ids &&
    Date.now() - openFeedIdsCache.at < OPEN_FEED_CACHE_MS
  ) {
    return openFeedIdsCache.ids;
  }
  const rows = await Community.find({
    type: { $in: OPEN_FEED_COMMUNITY_TYPES },
  })
    .select("_id")
    .lean();
  const ids = rows.map((row) => row._id);
  openFeedIdsCache = { ids, at: Date.now() };
  return ids;
};

const getCommunityIdsByChannel = async (channelName, { openFeedOnly = false } = {}) => {
  const name = String(channelName || "").trim();
  if (!name) return [];
  const escaped = escapeRegex(name);
  const filter = { channel: new RegExp(`^${escaped}$`, "i") };
  if (openFeedOnly) {
    filter.type = { $in: OPEN_FEED_COMMUNITY_TYPES };
  }
  const rows = await Community.find(filter).select("_id").lean();
  return rows.map((row) => row._id);
};

const resolveCommunityType = async (post) => {
  const community = post.community;
  if (!community) return null;
  if (typeof community === "object" && community.type) return community.type;
  const id = community._id || community;
  if (!id) return null;
  const doc = await Community.findById(id).select("type").lean();
  return doc?.type || null;
};

/** Anyone may view community-less + public community posts; private communities need membership. */
export const canViewPost = async (post, user) => {
  if (post.isArchived) {
    if (!user) return false;
    if (
      hasContentAdminPower(user) ||
      String(post.author?._id || post.author) === String(user._id)
    ) {
      return true;
    }
    const communityId = post.community?._id || post.community;
    return Boolean(
      communityId && (await canManagePostsInCommunity(communityId, user))
    );
  }
  if (hasContentAdminPower(user)) return true;
  const communityId = post.community?._id || post.community;
  if (!communityId) return true;

  const type = await resolveCommunityType(post);
  if (OPEN_FEED_COMMUNITY_TYPES.includes(type)) return true;

  if (!user) return false;
  return canEngageInCommunity(communityId, user);
};

/** Like / comment: community-less ok when logged in; community posts require membership. */
const canEngageWithPost = async (post, user) => {
  if (!user || post.isArchived) return false;
  if (hasContentAdminPower(user)) return true;
  const communityId = post.community?._id || post.community;
  if (!communityId) return true;
  return canEngageInCommunity(communityId, user);
};

const formatComment = (comment, extras = {}) => ({
  id: comment._id,
  text: comment.text,
  parent: comment.parent || null,
  post: comment.post,
  author: formatUser(comment.author),
  likeCount: extras.likeCount ?? 0,
  likedByMe: extras.likedByMe ?? false,
  canEdit: extras.canEdit ?? false,
  canDelete: extras.canDelete ?? false,
  isAuthor: extras.isAuthor ?? false,
  isLocked: extras.isLocked ?? false,
  editWindowMinutes: extras.editWindowMinutes ?? null,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});

const isDocAuthor = (doc, user) =>
  String(doc.author?._id || doc.author) === String(user._id);

const userCanEditOwn = async (doc, user) => {
  if (hasContentAdminPower(user)) return true;
  if (doc.isArchived) return false;
  if (!isDocAuthor(doc, user)) return false;
  return isWithinEditWindow(doc.createdAt);
};

const isLockedForAuthor = async (doc, user) => {
  if (hasContentAdminPower(user)) return false;
  if (!isDocAuthor(doc, user)) return false;
  return !(await isWithinEditWindow(doc.createdAt));
};

const buildOwnContentFlags = async (doc, user) => {
  const isAuthor = isDocAuthor(doc, user);
  const [canEdit, isLocked, editWindowMinutes] = await Promise.all([
    userCanEditOwn(doc, user),
    isLockedForAuthor(doc, user),
    getEditWindowMinutes(),
  ]);
  return { isAuthor, canEdit, isLocked, editWindowMinutes };
};

const userCanDeletePost = async (post, user) => {
  if (hasContentAdminPower(user)) return true;
  if (isDocAuthor(post, user) && post.isArchived) return true;
  const communityId = post.community?._id || post.community;
  if (!communityId) return false;
  return canManagePostsInCommunity(communityId, user);
};

const userCanDeleteComment = async (comment, user) => {
  const isAuthor = isDocAuthor(comment, user);
  if (hasContentAdminPower(user)) return true;
  if (isAuthor) return true;
  const post = await Post.findById(comment.post).select("community").lean();
  if (!post?.community) return false;
  return canManagePostsInCommunity(post.community, user);
};

export const listPosts = async (req, res) => {
  try {
    const { communityId, q, mine } = req.query;
    const channel = String(req.query.channel || "").trim();
    const sortBy = String(req.query.sortBy || "newest").trim().toLowerCase();
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
    });
    const access = await getViewerCommunityAccess(req.user);
    const { joinedIds, joinedIdSet, manageableIdSet } = access;

    const filter = {};
    const mineOnly = mine === "1" || mine === "true";
    let scopeFilter = null;

    if (mineOnly) {
      filter.author = req.user._id;
      filter.isArchived = req.query.archived === "1" ? true : { $ne: true };
    } else {
      filter.isArchived = { $ne: true };
    }

    if (!mineOnly && communityId !== undefined && communityId !== null && communityId !== "") {
      const parsedCommunityId = parseObjectIdInput(communityId);
      if (!parsedCommunityId) {
        return res.status(400).json({
          success: false,
          message: "Invalid community id.",
        });
      }

      const communityIdStr = String(parsedCommunityId);
      const allowed =
        hasContentAdminPower(req.user) ||
        joinedIdSet.has(communityIdStr) ||
        manageableIdSet.has(communityIdStr);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You cannot view posts in this community.",
        });
      }
      filter.community = parsedCommunityId;
    } else if (!mineOnly && (communityId === undefined || communityId === null || communityId === "")) {
      const followedIds = await getFollowedUserIds(req.user._id);
      let scopeIds = joinedIds;
      if (channel) {
        const channelIds = await getCommunityIdsByChannel(channel);
        const channelSet = new Set(channelIds.map(String));
        scopeIds = joinedIds.filter((id) => channelSet.has(String(id)));
      }

      const orConditions = [];
      if (scopeIds.length) {
        orConditions.push({ community: { $in: scopeIds } });
      }
      if (followedIds.length) {
        const openFeedIds = await getOpenFeedCommunityIds();
        const visibleCommunities = [
          ...new Set([
            ...openFeedIds.map(String),
            ...joinedIds.map(String),
          ]),
        ];
        orConditions.push({
          author: { $in: followedIds },
          $or: [
            { community: null },
            { community: { $in: visibleCommunities } },
          ],
        });
      }

      if (!orConditions.length) {
        const empty = { success: true, posts: [] };
        if (enabled) {
          empty.pagination = buildPaginationMeta({
            page,
            limit,
            total: 0,
            hasMore: false,
          });
        }
        return res.status(200).json(empty);
      }

      scopeFilter =
        orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
    }

    if (q && String(q).trim()) {
      const term = escapeRegex(String(q).trim());
      const textMatch = {
        $or: [
          { title: { $regex: term, $options: "i" } },
          { text: { $regex: term, $options: "i" } },
        ],
      };

      if (scopeFilter) {
        Object.assign(filter, { $and: [scopeFilter, textMatch] });
      } else if (Object.keys(filter).length) {
        const baseFilter = { ...filter };
        Object.keys(filter).forEach((key) => delete filter[key]);
        filter.$and = [baseFilter, textMatch];
      } else {
        Object.assign(filter, textMatch);
      }
    } else if (scopeFilter) {
      Object.assign(filter, scopeFilter);
    }

    const sort = postListSort(sortBy);

    let query = Post.find(filter)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage shortCode type channel")
      .sort(sort)
      .lean();

    if (enabled) {
      query = query.skip(skip).limit(limit + 1);
    }

    const found = await query;
    const { rows: posts, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };

    const postIds = posts.map((p) => p._id);
    const [{ liked, reshared, saved }, editWindowMinutes] = await Promise.all([
      getViewerEngagement(postIds, req.user._id),
      getEditWindowMinutes(),
    ]);

    const payload = {
      success: true,
      posts: posts.map((p) =>
        formatFeedPost(p, req.user, {
          liked,
          reshared,
          saved,
          joinedIdSet,
          manageableIdSet,
          editWindowMinutes,
        })
      ),
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, hasMore });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage shortCode type channel")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canViewPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this post.",
      });
    }

    const { liked, reshared, saved } = await getViewerEngagement([post._id], req.user._id);

    const canDelete = await userCanDeletePost(post, req.user);
    const flags = await buildOwnContentFlags(post, req.user);
    return res.status(200).json({
      success: true,
      post: formatPost(post, {
        likeCount: post.likeCount ?? 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount: post.commentCount ?? 0,
        reshareCount: post.reshareCount ?? 0,
        resharedByMe: reshared[String(post._id)] || false,
        savedByMe: saved[String(post._id)] || false,
        canDelete,
        canEngage: await canEngageWithPost(post, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

const HASHTAG_RE = /#([A-Za-z][A-Za-z0-9_]{1,49})/g;
const TRENDING_POST_SCAN = 800;

const collectHashtagsFromPosts = (posts = []) => {
  const counts = new Map();
  for (const post of posts) {
    const text = `${post.title || ""} ${post.text || ""}`;
    const seenInPost = new Set();
    for (const match of text.matchAll(HASHTAG_RE)) {
      const tag = match[1];
      const key = tag.toLowerCase();
      if (seenInPost.has(key)) continue;
      seenInPost.add(key);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return counts;
};

/** Public Discover sidebar: hashtags ranked by how many public posts use them. */
export const listTrendingTopics = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);
    const query = String(req.query.q || "")
      .trim()
      .replace(/^#/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 50);
    const posts = await Post.find({
      openFeed: true,
      isArchived: false,
    })
      .select("title text")
      .sort({ createdAt: -1 })
      .limit(TRENDING_POST_SCAN)
      .lean();

    const counts = collectHashtagsFromPosts(posts);

    let ranked = [...counts.values()];
    if (query) {
      ranked = ranked.filter((row) => row.tag.toLowerCase().includes(query));
      ranked.sort((a, b) => {
        const aStart = a.tag.toLowerCase().startsWith(query) ? 0 : 1;
        const bStart = b.tag.toLowerCase().startsWith(query) ? 0 : 1;
        return aStart - bStart || b.count - a.count || a.tag.localeCompare(b.tag);
      });
    } else {
      ranked.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }

    const topics = ranked.slice(0, limit).map((row) => ({
      tag: row.tag,
      postCount: row.count,
    }));

    return res.status(200).json({
      success: true,
      topics,
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load trending topics.");
  }
};

/** Discover feed: community-less + posts in public communities only. */
export const listPublicPosts = async (req, res) => {
  try {
    const { q } = req.query;
    const channel = String(req.query.channel || "").trim();
    const sortBy = String(req.query.sortBy || "newest").trim().toLowerCase();
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
    });

    const channelCommunityIds = channel
      ? await getCommunityIdsByChannel(channel, { openFeedOnly: true })
      : null;

    const visibility = channel
      ? { community: { $in: channelCommunityIds }, isArchived: false }
      : { openFeed: true, isArchived: false };

    let filter = visibility;
    if (q && String(q).trim()) {
      const term = escapeRegex(String(q).trim());
      filter = {
        $and: [
          visibility,
          {
            $or: [
              { title: { $regex: term, $options: "i" } },
              { text: { $regex: term, $options: "i" } },
            ],
          },
        ],
      };
    }

    const sort = postListSort(sortBy);
    const viewerId = req.user?._id || null;
    const pageLimit = enabled ? limit + 1 : limit;
    const hot = getHotSnapshot();
    const serveFromMemory =
      hot &&
      !channel &&
      !(q && String(q).trim()) &&
      (sortBy === "newest" || sortBy === "") &&
      enabled &&
      page === 1 &&
      limit <= 30 &&
      !hasContentAdminPower(req.user);

    if (serveFromMemory) {
      const posts = hot.posts.slice(0, limit);
      const viewerKey = viewerId ? String(viewerId) : "";
      const access = viewerKey
        ? hot.accessByUser.get(viewerKey) || {
            joinedIdSet: new Set(),
            manageableIdSet: new Set(),
          }
        : { joinedIdSet: new Set(), manageableIdSet: new Set() };
      const liked = {};
      const reshared = {};
      const saved = {};
      for (const post of posts) {
        const id = String(post._id);
        liked[id] = Boolean(viewerKey && hot.likedBy.get(id)?.has(viewerKey));
        reshared[id] = Boolean(
          viewerKey && hot.resharedBy.get(id)?.has(viewerKey)
        );
        saved[id] = Boolean(viewerKey && hot.savedBy.get(id)?.has(viewerKey));
      }
      const editWindowMinutes = req.user ? await getEditWindowMinutes() : null;
      return res.status(200).json({
        success: true,
        posts: posts.map((post) =>
          formatFeedPost(post, req.user, {
            liked,
            reshared,
            saved,
            joinedIdSet: access.joinedIdSet,
            manageableIdSet: access.manageableIdSet,
            editWindowMinutes,
          })
        ),
        pagination: buildPaginationMeta({
          page,
          limit,
          hasMore: hot.posts.length > limit,
        }),
      });
    }

    // One round trip. The API server and database are in different regions,
    // so separate populate/engagement queries were stacking into multi-second responses.
    const pipeline = [
      { $match: filter },
      { $sort: sort },
    ];
    if (enabled && skip) pipeline.push({ $skip: skip });
    pipeline.push({ $limit: pageLimit });
    pipeline.push(
      {
        $lookup: {
          from: User.collection.name,
          localField: "author",
          foreignField: "_id",
          pipeline: [
            { $project: { username: 1, name: 1, avatar: 1, role: 1 } },
          ],
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
      }
    );

    if (viewerId) {
      pipeline.push(
        {
          $lookup: {
            from: Reaction.collection.name,
            let: { postId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$targetId", "$$postId"] },
                      { $eq: ["$targetType", "post"] },
                      { $eq: ["$user", viewerId] },
                    ],
                  },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "myLike",
          },
        },
        {
          $lookup: {
            from: Reshare.collection.name,
            let: { postId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$post", "$$postId"] },
                      { $eq: ["$user", viewerId] },
                    ],
                  },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "myReshare",
          },
        },
        {
          $lookup: {
            from: Bookmark.collection.name,
            let: { postId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$targetId", "$$postId"] },
                      { $eq: ["$targetType", "post"] },
                      { $eq: ["$user", viewerId] },
                    ],
                  },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "mySave",
          },
        }
      );
    }

    const [found, access, editWindowMinutes] = await Promise.all([
      Post.aggregate(pipeline),
      req.user
        ? getViewerCommunityAccess(req.user)
        : Promise.resolve({
            joinedIdSet: new Set(),
            manageableIdSet: new Set(),
          }),
      req.user ? getEditWindowMinutes() : Promise.resolve(null),
    ]);

    const { rows: posts, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };

    const liked = {};
    const reshared = {};
    const saved = {};
    for (const post of posts) {
      const id = String(post._id);
      liked[id] = Boolean(post.myLike?.length);
      reshared[id] = Boolean(post.myReshare?.length);
      saved[id] = Boolean(post.mySave?.length);
    }

    const payload = {
      success: true,
      posts: posts.map((p) =>
        formatFeedPost(p, req.user, {
          liked,
          reshared,
          saved,
          joinedIdSet: access.joinedIdSet,
          manageableIdSet: access.manageableIdSet,
          editWindowMinutes,
        })
      ),
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, hasMore });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/** Get a single discoverable post (optional auth). */
export const getPublicPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage shortCode type channel")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (post.isArchived || !(await canViewPost(post, req.user || null))) {
      return res.status(404).json({
        success: false,
        message: "This post is not publicly available.",
      });
    }

    const userId = req.user?._id;
    const { liked, reshared, saved } = await getViewerEngagement([post._id], userId);

    if (!req.user) {
      return res.status(200).json({
        success: true,
        post: formatPost(post, {
          likeCount: post.likeCount ?? 0,
          likedByMe: false,
          commentCount: post.commentCount ?? 0,
          reshareCount: post.reshareCount ?? 0,
          resharedByMe: false,
          savedByMe: false,
          canEngage: false,
        }),
      });
    }

    const canDelete = await userCanDeletePost(post, req.user);
    const flags = await buildOwnContentFlags(post, req.user);
    return res.status(200).json({
      success: true,
      post: formatPost(post, {
        likeCount: post.likeCount ?? 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount: post.commentCount ?? 0,
        reshareCount: post.reshareCount ?? 0,
        resharedByMe: reshared[String(post._id)] || false,
        savedByMe: saved[String(post._id)] || false,
        canDelete,
        canEngage: await canEngageWithPost(post, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const createPost = async (req, res) => {
  try {
    const { communityId, title, text, media } = req.body;
    const parsedCommunityId = communityId
      ? parseObjectIdInput(communityId)
      : null;

    if (communityId != null && communityId !== "" && !parsedCommunityId) {
      return res.status(400).json({
        success: false,
        message: "Invalid community id.",
      });
    }

    const hasCommunity = Boolean(parsedCommunityId);
    let openFeed = true;

    if (hasCommunity) {
      const community = await Community.findById(parsedCommunityId);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found.",
        });
      }

      if (!(await canEngageInCommunity(parsedCommunityId, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You must be an active member to create posts.",
        });
      }
      openFeed = OPEN_FEED_COMMUNITY_TYPES.includes(community.type);
    }

    const cleanTitle = String(title || "").trim();
    const cleanText = String(text || "").trim();
    const mediaList = Array.isArray(media) ? media : [];

    if (!cleanText && !mediaList.length) {
      return res.status(400).json({
        success: false,
        message: "Post needs description or media.",
      });
    }

    if (await respondIfBanned(res, cleanTitle, cleanText)) return;

    const acceptedMedia = acceptSignedMediaList(req.user._id, mediaList, []);
    if (!acceptedMedia.ok) {
      return res.status(400).json({
        success: false,
        message: acceptedMedia.message,
      });
    }

    const postData = {
      author: req.user._id,
      title: cleanTitle,
      text: cleanText,
      likeCount: 0,
      commentCount: 0,
      reshareCount: 0,
      media: acceptedMedia.items,
      openFeed,
    };
    if (hasCommunity) {
      postData.community = parsedCommunityId;
    }

    const post = await Post.create(postData);

    await post.populate("author", "username name avatar role");
    if (hasCommunity) {
      await post.populate("community", "name coverImage shortCode");
    }

    refreshHotReads();

    return res.status(201).json({
      success: true,
      message: "Post created.",
      post: formatPost(post.toObject(), {
        likeCount: 0,
        likedByMe: false,
        commentCount: 0,
        reshareCount: 0,
        resharedByMe: false,
        canEdit: true,
        canDelete: false,
        isAuthor: true,
        isLocked: false,
        editWindowMinutes: await getEditWindowMinutes(),
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await userCanEditOwn(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: isDocAuthor(post, req.user)
          ? "Edit window expired. This post is locked."
          : "You do not have permission to edit this post.",
      });
    }

    const { title, text, media } = req.body;
    if (title !== undefined) {
      post.title = String(title).trim();
    }
    if (text !== undefined) post.text = String(text).trim();
    if (media !== undefined) {
      const acceptedMedia = acceptSignedMediaList(
        req.user._id,
        Array.isArray(media) ? media : [],
        post.media || []
      );
      if (!acceptedMedia.ok) {
        return res.status(400).json({
          success: false,
          message: acceptedMedia.message,
        });
      }
      const nextUrls = new Set(acceptedMedia.items.map((item) => item.url));
      const removed = (post.media || [])
        .map((item) => item.url)
        .filter((url) => url && !nextUrls.has(url));
      post.media = acceptedMedia.items;
      if (removed.length) {
        await destroyManyFromS3(removed);
      }
    }

    if (!String(post.title || "").trim() && !String(post.text || "").trim() && !(post.media || []).length) {
      return res.status(400).json({
        success: false,
        message: "Post needs a title, description, or media.",
      });
    }

    if (await respondIfBanned(res, post.title, post.text)) return;

    await post.save();
    await post.populate("author", "username name avatar role");
    await post.populate("community", "name coverImage shortCode");

    const { liked, reshared, saved } = await getViewerEngagement([post._id], req.user._id);
    const flags = await buildOwnContentFlags(post, req.user);
    const postObj = post.toObject();

    return res.status(200).json({
      success: true,
      message: "Post updated.",
      post: formatPost(postObj, {
        likeCount: postObj.likeCount ?? 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount: postObj.commentCount ?? 0,
        reshareCount: postObj.reshareCount ?? 0,
        resharedByMe: reshared[String(post._id)] || false,
        savedByMe: saved[String(post._id)] || false,
        canDelete: await userCanDeletePost(post, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const canDelete = await userCanDeletePost(post, req.user);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this post.",
      });
    }

    const comments = await Comment.find({ post: post._id }).select("_id");
    const commentIds = comments.map((c) => c._id);

    const mediaUrls = (post.media || [])
      .map((item) => item?.url)
      .filter(Boolean);

    await Reaction.deleteMany({
      $or: [
        { targetType: "post", targetId: post._id },
        { targetType: "comment", targetId: { $in: commentIds } },
      ],
    });
    await Reshare.deleteMany({ post: post._id });
    await Bookmark.deleteMany({ targetType: "post", targetId: post._id });
    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);
    if (mediaUrls.length) await destroyManyFromS3(mediaUrls);
    refreshHotReads();

    return res.status(200).json({
      success: true,
      message: "Post deleted.",
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const setPostArchived = async (req, res) => {
  try {
    if (typeof req.body?.archived !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "The archived value must be a boolean.",
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }
    if (!isDocAuthor(post, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only the post author can archive or restore this post.",
      });
    }

    post.isArchived = req.body.archived;
    post.archivedAt = req.body.archived ? new Date() : null;
    await post.save();

    return res.status(200).json({
      success: true,
      message: req.body.archived ? "Post archived." : "Post restored.",
      post: {
        id: post._id,
        isArchived: post.isArchived,
        archivedAt: post.archivedAt,
      },
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listComments = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("community", "type")
      .lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canViewPost(post, req.user || null))) {
      return res.status(403).json({
        success: false,
        message: "You cannot view comments on this post.",
      });
    }

    const comments = await Comment.find({ post: post._id })
      .populate("author", "username name avatar role")
      .sort({ createdAt: 1 })
      .lean();

    const ids = comments.map((c) => c._id);
    const userId = req.user?._id;
    const { liked } = await getLikeMeta("comment", ids, userId);

    if (!req.user) {
      return res.status(200).json({
        success: true,
        comments: comments.map((c) =>
          formatComment(c, {
            likeCount: c.likeCount ?? 0,
            likedByMe: false,
          })
        ),
      });
    }

    const editWindowMinutes = await getEditWindowMinutes();
    const commentsWithPermission = await Promise.all(
      comments.map(async (c) => {
        const flags = await buildOwnContentFlags(c, req.user);
        return {
          comment: c,
          canDelete: await userCanDeleteComment(c, req.user),
          ...flags,
        };
      })
    );

    return res.status(200).json({
      success: true,
      comments: commentsWithPermission.map(
        ({ comment: c, canDelete, isAuthor, canEdit, isLocked }) =>
          formatComment(c, {
            likeCount: c.likeCount ?? 0,
            likedByMe: liked[String(c._id)] || false,
            canEdit,
            canDelete,
            isAuthor,
            isLocked,
            editWindowMinutes,
          })
      ),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const createComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageWithPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can comment.",
      });
    }

    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required.",
      });
    }

    if (await respondIfBanned(res, text)) return;

    let parent = null;
    if (req.body.parentId) {
      const parentId = parseObjectIdInput(req.body.parentId);
      if (!parentId) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent comment id.",
        });
      }
      parent = await Comment.findOne({
        _id: parentId,
        post: post._id,
      });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent comment not found.",
        });
      }
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      parent: parent?._id || null,
      text,
      likeCount: 0,
    });

    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    await comment.populate("author", "username name avatar role");

    const io = req.app.get("io");
    const commenterId = String(req.user._id);
    const postAuthorId = String(post.author);
    const parentAuthorId = parent ? String(parent.author) : null;
    const postEntity = {
      kind: "post",
      id: post._id,
      shortCode: post.shortCode,
      title: post.title || "",
    };

    if (parent && parentAuthorId && parentAuthorId !== commenterId) {
      await notify({
        io,
        recipientId: parent.author,
        actor: req.user,
        type: "reply",
        title: `${personName(req.user)} replied to your comment`,
        body: snippet(text),
        entity: postEntity,
        community: post.community,
      });
    }

    if (
      postAuthorId &&
      postAuthorId !== commenterId &&
      postAuthorId !== parentAuthorId
    ) {
      await notify({
        io,
        recipientId: post.author,
        actor: req.user,
        type: "comment",
        title: `${personName(req.user)} commented on your post`,
        body: snippet(text),
        entity: postEntity,
        community: post.community,
      });
    }

    return res.status(201).json({
      success: true,
      comment: formatComment(comment.toObject(), {
        likeCount: 0,
        likedByMe: false,
        canEdit: true,
        canDelete: true,
        isAuthor: true,
        isLocked: false,
        editWindowMinutes: await getEditWindowMinutes(),
      }),
      commentCount: (post.commentCount ?? 0) + 1,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const post = await Post.findById(comment.post).select("isArchived");
    if (post?.isArchived) {
      return res.status(403).json({
        success: false,
        message: "Comments on archived posts cannot be edited.",
      });
    }

    if (!(await userCanEditOwn(comment, req.user))) {
      return res.status(403).json({
        success: false,
        message: isDocAuthor(comment, req.user)
          ? "Edit window expired. This comment is locked."
          : "You do not have permission to edit this comment.",
      });
    }

    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required.",
      });
    }

    if (await respondIfBanned(res, text)) return;

    comment.text = text;
    await comment.save();
    await comment.populate("author", "username name avatar role");

    const { liked } = await getLikeMeta("comment", [comment._id], req.user._id);
    const flags = await buildOwnContentFlags(comment, req.user);
    const commentObj = comment.toObject();

    return res.status(200).json({
      success: true,
      comment: formatComment(commentObj, {
        likeCount: commentObj.likeCount ?? 0,
        likedByMe: liked[String(comment._id)] || false,
        canDelete: await userCanDeleteComment(comment, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const canDelete = await userCanDeleteComment(comment, req.user);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this comment.",
      });
    }

    const replies = await Comment.find({ parent: comment._id }).select("_id");
    const ids = [comment._id, ...replies.map((r) => r._id)];
    const postId = comment.post;

    await Reaction.deleteMany({
      targetType: "comment",
      targetId: { $in: ids },
    });
    await Comment.deleteMany({ _id: { $in: ids } });
    await Post.updateOne(
      { _id: postId },
      { $inc: { commentCount: -ids.length } }
    );
    await clampNonNegative(Post, postId, "commentCount");

    return res.status(200).json({
      success: true,
      message: "Comment deleted.",
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

const toggleLike = async (targetType, targetId, user) => {
  const existing = await Reaction.findOne({
    targetType,
    targetId,
    user: user._id,
  });

  const Model = targetType === "post" ? Post : Comment;
  const delta = existing ? -1 : 1;

  if (existing) {
    await existing.deleteOne();
  } else {
    await Reaction.create({ targetType, targetId, user: user._id });
  }

  const updated = await Model.findByIdAndUpdate(
    targetId,
    { $inc: { likeCount: delta } },
    { new: true }
  ).select("likeCount");

  if (updated && updated.likeCount < 0) {
    updated.likeCount = 0;
    await updated.save();
  }

  return {
    likeCount: updated?.likeCount ?? 0,
    likedByMe: !existing,
  };
};

export const togglePostLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageWithPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can like posts.",
      });
    }

    const result = await toggleLike("post", post._id, req.user);
    if (result.likedByMe) {
      await notify({
        io: req.app.get("io"),
        recipientId: post.author,
        actor: req.user,
        type: "like",
        title: `${personName(req.user)} liked your post`,
        entity: {
          kind: "post",
          id: post._id,
          shortCode: post.shortCode,
          title: post.title || "",
        },
        community: post.community,
        collapse: true,
      });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const togglePostReshare = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageWithPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can repost.",
      });
    }

    const existing = await Reshare.findOne({
      post: post._id,
      user: req.user._id,
    });

    const delta = existing ? -1 : 1;
    if (existing) {
      await existing.deleteOne();
    } else {
      await Reshare.create({ post: post._id, user: req.user._id });
    }

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { reshareCount: delta } },
      { new: true }
    ).select("reshareCount");

    if (updated && updated.reshareCount < 0) {
      updated.reshareCount = 0;
      await updated.save();
    }

    if (!existing) {
      await notify({
        io: req.app.get("io"),
        recipientId: post.author,
        actor: req.user,
        type: "reshare",
        title: `${personName(req.user)} reshared your post`,
        entity: {
          kind: "post",
          id: post._id,
          shortCode: post.shortCode,
          title: post.title || "",
        },
        community: post.community,
        collapse: true,
      });
    }

    return res.status(200).json({
      success: true,
      reshareCount: updated?.reshareCount ?? 0,
      resharedByMe: !existing,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const updated = await Post.findById(req.params.id).select("reshareCount");
      return res.status(200).json({
        success: true,
        reshareCount: updated?.reshareCount ?? 0,
        resharedByMe: true,
      });
    }
    return sendServerError(res, error);
  }
};

export const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const post = await Post.findById(comment.post);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (post.isArchived) {
      return res.status(403).json({
        success: false,
        message: "Comments on archived posts cannot be liked.",
      });
    }

    const isPostAuthor =
      String(post.author) === String(req.user._id);
    if (!isPostAuthor && !(await canViewPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You cannot like comments on this post.",
      });
    }

    const result = await toggleLike("comment", comment._id, req.user);
    if (result.likedByMe) {
      await notify({
        io: req.app.get("io"),
        recipientId: comment.author,
        actor: req.user,
        type: "like",
        title: `${personName(req.user)} liked your comment`,
        body: snippet(comment.text),
        entity: {
          kind: "post",
          id: post._id,
          shortCode: post.shortCode,
          title: post.title || "",
        },
        community: post.community,
      });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * Maps the short code carried in a post URL back to its id. Access checks stay
 * on the endpoints that actually return post data.
 */
export const resolvePostCode = async (req, res) => {
  try {
    const id = await resolveDocumentId(Post, req.params.code);
    if (!id) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const post = await Post.findById(id)
      .select("community author isArchived")
      .lean();
    if (!post || !(await canViewPost(post, req.user || null))) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    return res.status(200).json({ success: true, id });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/** Authenticated user's own comments (activity history). */
export const listMyComments = async (req, res) => {
  try {
    const comments = await Comment.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("author", "username name avatar role")
      .populate({
        path: "post",
        select: "title text community shortCode author createdAt isArchived",
        populate: [
          { path: "community", select: "name shortCode coverImage" },
          { path: "author", select: "username name avatar" },
        ],
      })
      .lean();

    const commentIds = comments.map((c) => c._id);
    const { liked } = await getLikeMeta("comment", commentIds, req.user._id);
    const editWindowMinutes = await getEditWindowMinutes();

    const visibleComments = comments.filter((comment) => {
      const post = comment.post;
      if (!post?.isArchived) return true;
      return String(post.author?._id || post.author) === String(req.user._id);
    });

    const items = await Promise.all(
      visibleComments.map(async (c) => {
        const flags = await buildOwnContentFlags(c, req.user);
        const canDelete = await userCanDeleteComment(c, req.user);
        const post = c.post;
        let postPayload = null;
        if (post && typeof post === "object" && post._id) {
          postPayload = {
            id: post._id,
            shortCode: post.shortCode || "",
            title: post.title || "",
            text: post.text || "",
            community:
              post.community && typeof post.community === "object" && post.community._id
                ? {
                    id: post.community._id,
                    name: post.community.name,
                    shortCode: post.community.shortCode || "",
                    coverImage: post.community.coverImage || "",
                  }
                : post.community
                  ? { id: post.community }
                  : null,
            author: formatUser(post.author),
            createdAt: post.createdAt,
          };
        } else if (post) {
          postPayload = { id: post };
        }

        return {
          ...formatComment(c, {
            likeCount: c.likeCount ?? 0,
            likedByMe: liked[String(c._id)] || false,
            canEdit: flags.canEdit,
            canDelete,
            isAuthor: flags.isAuthor,
            isLocked: flags.isLocked,
            editWindowMinutes,
          }),
          post: postPayload,
          isReply: Boolean(c.parent),
        };
      })
    );

    // Drop comments whose post was deleted
    const filtered = items.filter((item) => item.post?.id);

    return res.json({ success: true, comments: filtered });
  } catch (error) {
    return sendServerError(res, error, "Failed to load comments.");
  }
};

/** Posts the authenticated user has liked (activity history). */
export const listMyLikedPosts = async (req, res) => {
  try {
    const reactions = await Reaction.find({
      user: req.user._id,
      targetType: "post",
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const postIds = reactions.map((r) => r.targetId);
    if (!postIds.length) {
      return res.json({ success: true, posts: [] });
    }

    const posts = await Post.find({
      _id: { $in: postIds },
      isArchived: { $ne: true },
    })
      .populate("author", "username name avatar role")
      .populate("community", "name shortCode coverImage")
      .lean();

    const postMap = Object.fromEntries(posts.map((p) => [String(p._id), p]));
    const { reshared } = await getViewerEngagement(postIds, req.user._id);
    const editWindowMinutes = await getEditWindowMinutes();
    const likedAtMap = Object.fromEntries(
      reactions.map((r) => [String(r.targetId), r.createdAt])
    );

    const ordered = [];
    for (const id of postIds) {
      const p = postMap[String(id)];
      if (!p) continue;
      const flags = await buildOwnContentFlags(p, req.user);
      ordered.push({
        ...formatPost(p, {
          likeCount: p.likeCount ?? 0,
          likedByMe: true,
          commentCount: p.commentCount ?? 0,
          reshareCount: p.reshareCount ?? 0,
          resharedByMe: reshared[String(p._id)] || false,
          canEdit: flags.canEdit,
          canDelete: await userCanDeletePost(p, req.user),
          isAuthor: flags.isAuthor,
          isLocked: flags.isLocked,
          editWindowMinutes,
        }),
        likedAt: likedAtMap[String(id)] || null,
      });
    }

    return res.json({ success: true, posts: ordered });
  } catch (error) {
    return sendServerError(res, error, "Failed to load liked posts.");
  }
};

/** Posts the authenticated user has reposted (activity history). */
export const listMyResharedPosts = async (req, res) => {
  try {
    const reshares = await Reshare.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const postIds = reshares.map((row) => row.post);
    if (!postIds.length) {
      return res.json({ success: true, posts: [] });
    }

    const posts = await Post.find({
      _id: { $in: postIds },
      isArchived: { $ne: true },
    })
      .populate("author", "username name avatar role")
      .populate("community", "name shortCode coverImage")
      .lean();

    const postMap = Object.fromEntries(posts.map((p) => [String(p._id), p]));
    const { liked } = await getViewerEngagement(postIds, req.user._id);
    const editWindowMinutes = await getEditWindowMinutes();
    const resharedAtMap = Object.fromEntries(
      reshares.map((row) => [String(row.post), row.createdAt])
    );

    const ordered = [];
    for (const id of postIds) {
      const p = postMap[String(id)];
      if (!p) continue;
      const flags = await buildOwnContentFlags(p, req.user);
      ordered.push({
        ...formatPost(p, {
          likeCount: p.likeCount ?? 0,
          likedByMe: liked[String(p._id)] || false,
          commentCount: p.commentCount ?? 0,
          reshareCount: p.reshareCount ?? 0,
          resharedByMe: true,
          canEdit: flags.canEdit,
          canDelete: await userCanDeletePost(p, req.user),
          isAuthor: flags.isAuthor,
          isLocked: flags.isLocked,
          editWindowMinutes,
        }),
        resharedAt: resharedAtMap[String(id)] || null,
      });
    }

    return res.json({ success: true, posts: ordered });
  } catch (error) {
    return sendServerError(res, error, "Failed to load reposts.");
  }
};

/** Admin: list all posts (community + public) for content moderation. */
export const adminListModerationPosts = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const scope = String(req.query.scope || "all").toLowerCase();
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const and = [];
    if (scope === "community") {
      and.push({ community: { $ne: null } });
    } else if (scope === "public") {
      and.push({
        $or: [{ community: null }, { community: { $exists: false } }],
      });
    }
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      and.push({ $or: [{ title: regex }, { text: regex }] });
    }
    const filter = and.length ? { $and: and } : {};

    const total = await Post.countDocuments(filter);
    let query = Post.find(filter)
      .sort({ createdAt: -1 })
      .populate("author", "username name avatar role status")
      .populate("community", "name shortCode coverImage");

    if (enabled) {
      query = query.skip(skip).limit(limit);
    } else {
      query = query.limit(100);
    }

    const posts = await query.lean();
    const [communityTotal, publicTotal] = await Promise.all([
      Post.countDocuments({ community: { $ne: null } }),
      Post.countDocuments({
        $or: [{ community: null }, { community: { $exists: false } }],
      }),
    ]);

    const payload = {
      success: true,
      posts: posts.map((p) => ({
        ...formatPost(p, {
          likeCount: p.likeCount ?? 0,
          likedByMe: false,
          commentCount: p.commentCount ?? 0,
          canEdit: true,
          canDelete: true,
          isAuthor: false,
          isLocked: false,
        }),
        authorStatus:
          p.author && typeof p.author === "object"
            ? p.author.status || "active"
            : null,
        mediaCount: Array.isArray(p.media) ? p.media.length : 0,
      })),
      summary: {
        all: communityTotal + publicTotal,
        community: communityTotal,
        public: publicTotal,
      },
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, total });
    }

    return res.json(payload);
  } catch (error) {
    return sendServerError(res, error, "Failed to list posts.");
  }
};

/** Admin: list all comments for content moderation. */
export const adminListModerationComments = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const filter = {};
    if (q) {
      filter.text = {
        $regex: escapeRegex(q),
        $options: "i",
      };
    }

    const total = await Comment.countDocuments(filter);
    let query = Comment.find(filter)
      .sort({ createdAt: -1 })
      .populate("author", "username name avatar role status")
      .populate({
        path: "post",
        select: "title text community shortCode",
        populate: { path: "community", select: "name shortCode" },
      });

    if (enabled) {
      query = query.skip(skip).limit(limit);
    } else {
      query = query.limit(100);
    }

    const comments = await query.lean();
    const items = comments.map((c) => {
      const post = c.post;
      let postPayload = null;
      if (post && typeof post === "object" && post._id) {
        postPayload = {
          id: post._id,
          shortCode: post.shortCode || "",
          title: post.title || "",
          community:
            post.community &&
            typeof post.community === "object" &&
            post.community._id
              ? {
                  id: post.community._id,
                  name: post.community.name,
                  shortCode: post.community.shortCode || "",
                }
              : post.community
                ? { id: post.community }
                : null,
        };
      } else if (post) {
        postPayload = { id: post };
      }

      return {
        ...formatComment(c, {
            likeCount: c.likeCount ?? 0,
          likedByMe: false,
          canEdit: true,
          canDelete: true,
          isAuthor: false,
          isLocked: false,
        }),
        post: postPayload,
        isReply: Boolean(c.parent),
        authorStatus:
          c.author && typeof c.author === "object"
            ? c.author.status || "active"
            : null,
      };
    });

    const payload = {
      success: true,
      comments: items,
      summary: { all: total },
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, total });
    }

    return res.json(payload);
  } catch (error) {
    return sendServerError(res, error, "Failed to list comments.");
  }
};

/** Shared formatter for bookmark lists. */
export const formatPostForBookmark = async (post, user) => {
  const [access, editWindowMinutes, engagement] = await Promise.all([
    getViewerCommunityAccess(user),
    getEditWindowMinutes(),
    getViewerEngagement([post._id], user._id),
  ]);
  return formatFeedPost(post, user, {
    liked: engagement.liked,
    reshared: engagement.reshared,
    saved: engagement.saved,
    joinedIdSet: access.joinedIdSet,
    manageableIdSet: access.manageableIdSet,
    editWindowMinutes,
  });
};
