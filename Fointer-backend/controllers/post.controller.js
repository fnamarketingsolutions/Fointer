import mongoose from "mongoose";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reaction from "../models/reaction.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import {
  canCreatePost,
  canEngageInCommunity,
  canManagePostsInCommunity,
  isWithinEditWindow,
  getEditWindowMinutes,
  getEffectiveMemberRole,
} from "../utils/communityPermissions.js";
import {
  parsePagination,
  resolveSort,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { parseObjectIdInput, resolveDocumentId } from "../utils/shortCode.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";

const POST_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

const formatUser = (user) => {
  if (!user || typeof user !== "object" || !user._id) {
    return { id: user };
  }
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
    role: user.role || "user",
  };
};

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
    likeCount: extras.likeCount ?? 0,
    likedByMe: extras.likedByMe ?? false,
    commentCount: extras.commentCount ?? 0,
    canEdit: extras.canEdit ?? false,
    canDelete: extras.canDelete ?? false,
    canEngage: extras.canEngage ?? false,
    isAuthor: extras.isAuthor ?? false,
    isLocked: extras.isLocked ?? false,
    editWindowMinutes: extras.editWindowMinutes ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const DISCOVERABLE_COMMUNITY_TYPES = ["public", "private_request"];

const getDiscoverableCommunityIds = async () => {
  const rows = await Community.find({
    type: { $in: DISCOVERABLE_COMMUNITY_TYPES },
  })
    .select("_id")
    .lean();
  return rows.map((row) => row._id);
};

const getCommunityIdsByChannel = async (channelName, { discoverableOnly = false } = {}) => {
  const name = String(channelName || "").trim();
  if (!name) return [];
  const escaped = escapeRegex(name);
  const filter = { channel: new RegExp(`^${escaped}$`, "i") };
  if (discoverableOnly) {
    filter.type = { $in: DISCOVERABLE_COMMUNITY_TYPES };
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

/** Anyone may view community-less + discoverable community posts; private invite needs membership. */
const canViewPost = async (post, user) => {
  if (user?.role === "admin") return true;
  const communityId = post.community?._id || post.community;
  if (!communityId) return true;

  const type = await resolveCommunityType(post);
  if (DISCOVERABLE_COMMUNITY_TYPES.includes(type)) return true;

  if (!user) return false;
  return (
    (await canEngageInCommunity(communityId, user)) ||
    (await canCreatePost(communityId, user))
  );
};

/** Like / comment: community-less ok when logged in; community posts require membership. */
const canEngageWithPost = async (post, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
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
  if (user.role === "admin") return true;
  if (!isDocAuthor(doc, user)) return false;
  return isWithinEditWindow(doc.createdAt);
};

const isLockedForAuthor = async (doc, user) => {
  if (user.role === "admin") return false;
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
  const isAuthor = isDocAuthor(post, user);
  const isAdmin = user.role === "admin";
  if (isAdmin) return true;
  if (isAuthor && (await isWithinEditWindow(post.createdAt))) return true;
  const communityId = post.community?._id || post.community;
  if (!communityId) return false;
  return canManagePostsInCommunity(communityId, user);
};

const userCanDeleteComment = async (comment, user) => {
  const isAuthor = isDocAuthor(comment, user);
  const isAdmin = user.role === "admin";
  if (isAdmin) return true;
  if (isAuthor && (await isWithinEditWindow(comment.createdAt))) return true;
  const post = await Post.findById(comment.post).select("community").lean();
  if (!post?.community) return false;
  return canManagePostsInCommunity(post.community, user);
};

/** Communities where user is an active member (or all for admin) */
export const listJoinedCommunityIds = async (user) => {
  if (user.role === "admin") {
    const all = await Community.find().select("_id").lean();
    return all.map((c) => c._id);
  }

  const memberships = await CommunityMember.find({
    user: user._id,
    status: "active",
  }).select("community");

  return memberships.map((m) => m.community);
};

/** Communities where user is owner or active (non-expired) moderator */
export const listManageableCommunityIds = async (user) => {
  if (user.role === "admin") {
    const all = await Community.find().select("_id").lean();
    return all.map((c) => c._id);
  }

  const memberships = await CommunityMember.find({
    user: user._id,
    status: "active",
    role: { $in: ["owner", "moderator"] },
  });

  return memberships
    .filter((m) => getEffectiveMemberRole(m) === "owner" || getEffectiveMemberRole(m) === "moderator")
    .map((m) => m.community);
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
    const joinedIds = await listJoinedCommunityIds(req.user);
    const manageableIds = await listManageableCommunityIds(req.user);

    const filter = {};
    const mineOnly = mine === "1" || mine === "true";

    if (mineOnly) {
      filter.author = req.user._id;
    } else if (communityId !== undefined && communityId !== null && communityId !== "") {
      const parsedCommunityId = parseObjectIdInput(communityId);
      if (!parsedCommunityId) {
        return res.status(400).json({
          success: false,
          message: "Invalid community id.",
        });
      }

      const communityIdStr = String(parsedCommunityId);
      const allowed =
        req.user.role === "admin" ||
        (await canEngageInCommunity(parsedCommunityId, req.user)) ||
        manageableIds.some((id) => String(id) === communityIdStr) ||
        joinedIds.some((id) => String(id) === communityIdStr);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You cannot view posts in this community.",
        });
      }
      filter.community = parsedCommunityId;
    } else {
      // Default: posts in communities the user has joined
      let scopeIds = joinedIds;
      if (channel) {
        const channelIds = await getCommunityIdsByChannel(channel);
        const channelSet = new Set(channelIds.map(String));
        scopeIds = joinedIds.filter((id) => channelSet.has(String(id)));
      }
      if (!scopeIds.length) {
        const empty = { success: true, posts: [] };
        if (enabled) {
          empty.pagination = buildPaginationMeta({ page, limit, total: 0 });
        }
        return res.status(200).json(empty);
      }
      filter.community = { $in: scopeIds };
    }

    if (q && String(q).trim()) {
      const term = escapeRegex(String(q).trim());
      filter.$or = [
        { title: { $regex: term, $options: "i" } },
        { text: { $regex: term, $options: "i" } },
      ];
    }

    let posts = [];
    let total = null;
    const sort =
      sortBy === "likes"
        ? { likeCount: -1, createdAt: -1 }
        : sortBy === "comments"
          ? { commentCount: -1, createdAt: -1 }
          : resolveSort(sortBy, POST_SORT_MAP, { createdAt: -1 });

    let query = Post.find(filter)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage shortCode type channel")
      .sort(sort)
      .lean();

    if (enabled) {
      total = await Post.countDocuments(filter);
      query = query.skip(skip).limit(limit);
    }

    posts = await query;

    const postIds = posts.map((p) => p._id);
    const { liked } = await getLikeMeta("post", postIds, req.user._id);

    const editWindowMinutes = await getEditWindowMinutes();
    const postsWithPermission = await Promise.all(
      posts.map(async (p) => {
        const flags = await buildOwnContentFlags(p, req.user);
        return {
          post: p,
          canDelete: await userCanDeletePost(p, req.user),
          ...flags,
        };
      })
    );

    const payload = {
      success: true,
      posts: await Promise.all(
        postsWithPermission.map(
          async ({ post: p, canDelete, isAuthor, canEdit, isLocked }) =>
            formatPost(p, {
              likeCount: p.likeCount ?? 0,
              likedByMe: liked[String(p._id)] || false,
              commentCount: p.commentCount ?? 0,
              canEdit,
              canDelete,
              canEngage: await canEngageWithPost(p, req.user),
              isAuthor,
              isLocked,
              editWindowMinutes,
            })
        )
      ),
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, total });
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

    const { liked } = await getLikeMeta("post", [post._id], req.user._id);

    const canDelete = await userCanDeletePost(post, req.user);
    const flags = await buildOwnContentFlags(post, req.user);
    return res.status(200).json({
      success: true,
      post: formatPost(post, {
        likeCount: post.likeCount ?? 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount: post.commentCount ?? 0,
        canDelete,
        canEngage: await canEngageWithPost(post, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/** Discover feed: community-less + posts in public / request-to-join communities. */
export const listPublicPosts = async (req, res) => {
  try {
    const { q } = req.query;
    const channel = String(req.query.channel || "").trim();
    const sortBy = String(req.query.sortBy || "newest").trim().toLowerCase();
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
    });

    let visibility;
    if (channel) {
      const channelCommunityIds = await getCommunityIdsByChannel(channel, {
        discoverableOnly: true,
      });
      visibility = {
        community: { $in: channelCommunityIds },
      };
    } else {
      const discoverableIds = await getDiscoverableCommunityIds();
      const visibilityOr = [
        { community: null },
        { community: { $exists: false } },
      ];
      if (discoverableIds.length) {
        visibilityOr.push({ community: { $in: discoverableIds } });
      }
      visibility = { $or: visibilityOr };
    }

    let filter = { ...visibility };
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

    let posts = [];
    let total = null;
    const communityPopulate = {
      path: "community",
      select: "name coverImage shortCode type channel",
    };
    const sort =
      sortBy === "likes"
        ? { likeCount: -1, createdAt: -1 }
        : sortBy === "comments"
          ? { commentCount: -1, createdAt: -1 }
          : resolveSort(sortBy, POST_SORT_MAP, { createdAt: -1 });

    let query = Post.find(filter)
      .populate("author", "username name avatar role")
      .populate(communityPopulate)
      .sort(sort)
      .lean();

    if (enabled) {
      total = await Post.countDocuments(filter);
      query = query.skip(skip).limit(limit);
    }

    posts = await query;

    const postIds = posts.map((p) => p._id);
    const userId = req.user?._id;
    const { liked } = await getLikeMeta("post", postIds, userId);

    const editWindowMinutes = req.user ? await getEditWindowMinutes() : null;
    const postsFormatted = await Promise.all(
      posts.map(async (p) => {
        if (!req.user) {
          return formatPost(p, {
            likeCount: p.likeCount ?? 0,
            likedByMe: false,
            commentCount: p.commentCount ?? 0,
            canEngage: false,
          });
        }
        const flags = await buildOwnContentFlags(p, req.user);
        return formatPost(p, {
          likeCount: p.likeCount ?? 0,
          likedByMe: liked[String(p._id)] || false,
          commentCount: p.commentCount ?? 0,
          canDelete: await userCanDeletePost(p, req.user),
          canEngage: await canEngageWithPost(p, req.user),
          ...flags,
          editWindowMinutes,
        });
      })
    );

    const payload = {
      success: true,
      posts: postsFormatted,
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, total });
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

    if (!(await canViewPost(post, req.user || null))) {
      return res.status(404).json({
        success: false,
        message: "This post is not publicly available.",
      });
    }

    const userId = req.user?._id;
    const { liked } = await getLikeMeta("post", [post._id], userId);

    if (!req.user) {
      return res.status(200).json({
        success: true,
        post: formatPost(post, {
          likeCount: post.likeCount ?? 0,
          likedByMe: false,
          commentCount: post.commentCount ?? 0,
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
    const hasCommunity = Boolean(communityId);

    if (hasCommunity) {
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found.",
        });
      }

      if (!(await canCreatePost(communityId, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You must be an active member to create posts.",
        });
      }
    }

    const cleanTitle = String(title || "").trim();
    const cleanText = String(text || "").trim();
    const mediaList = Array.isArray(media) ? media : [];

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Post title is required.",
      });
    }

    if (!cleanText && !mediaList.length) {
      return res.status(400).json({
        success: false,
        message: "Post needs description or media.",
      });
    }

    const postData = {
      author: req.user._id,
      title: cleanTitle,
      text: cleanText,
      likeCount: 0,
      commentCount: 0,
      media: mediaList.map((m) => ({
        url: m.url,
        publicId: m.publicId || "",
        type: m.type === "video" ? "video" : "image",
      })),
    };
    if (hasCommunity) {
      postData.community = communityId;
    }

    const post = await Post.create(postData);

    await post.populate("author", "username name avatar role");
    if (hasCommunity) {
      await post.populate("community", "name coverImage shortCode");
    }

    return res.status(201).json({
      success: true,
      message: "Post created.",
      post: formatPost(post.toObject(), {
        likeCount: 0,
        likedByMe: false,
        commentCount: 0,
        canEdit: true,
        canDelete: true,
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
      const cleanTitle = String(title).trim();
      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message: "Post title cannot be empty.",
        });
      }
      post.title = cleanTitle;
    }
    if (text !== undefined) post.text = String(text).trim();
    if (media !== undefined) {
      post.media = (Array.isArray(media) ? media : []).map((m) => ({
        url: m.url,
        publicId: m.publicId || "",
        type: m.type === "video" ? "video" : "image",
      }));
    }

    await post.save();
    await post.populate("author", "username name avatar role");
    await post.populate("community", "name coverImage shortCode");

    const { liked } = await getLikeMeta("post", [post._id], req.user._id);
    const flags = await buildOwnContentFlags(post, req.user);
    const postObj = post.toObject();

    return res.status(200).json({
      success: true,
      message: "Post updated.",
      post: formatPost(postObj, {
        likeCount: postObj.likeCount ?? 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount: postObj.commentCount ?? 0,
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
        message: isDocAuthor(post, req.user)
          ? "Edit window expired. This post is locked."
          : "You do not have permission to delete this post.",
      });
    }

    const comments = await Comment.find({ post: post._id }).select("_id");
    const commentIds = comments.map((c) => c._id);

    await Reaction.deleteMany({
      $or: [
        { targetType: "post", targetId: post._id },
        { targetType: "comment", targetId: { $in: commentIds } },
      ],
    });
    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);

    return res.status(200).json({
      success: true,
      message: "Post deleted.",
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

    let parent = null;
    if (req.body.parentId) {
      parent = await Comment.findOne({
        _id: req.body.parentId,
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
        message: isDocAuthor(comment, req.user)
          ? "Edit window expired. This comment is locked."
          : "You do not have permission to delete this comment.",
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
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
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

    if (!(await canEngageWithPost(post, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can like comments.",
      });
    }

    const result = await toggleLike("comment", comment._id, req.user);
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
        select: "title text community shortCode author createdAt",
        populate: [
          { path: "community", select: "name shortCode coverImage" },
          { path: "author", select: "username name avatar" },
        ],
      })
      .lean();

    const commentIds = comments.map((c) => c._id);
    const { liked } = await getLikeMeta("comment", commentIds, req.user._id);
    const editWindowMinutes = await getEditWindowMinutes();

    const items = await Promise.all(
      comments.map(async (c) => {
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

    const posts = await Post.find({ _id: { $in: postIds } })
      .populate("author", "username name avatar role")
      .populate("community", "name shortCode coverImage")
      .lean();

    const postMap = Object.fromEntries(posts.map((p) => [String(p._id), p]));
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
