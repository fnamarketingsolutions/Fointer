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
// import { logActivity } from "../utils/logActivity.js";

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
  if (!targetIds.length) return { counts: {}, liked: {} };

  const reactions = await Reaction.find({
    targetType,
    targetId: { $in: targetIds },
  }).lean();

  const counts = {};
  const liked = {};
  for (const id of targetIds) {
    counts[String(id)] = 0;
    liked[String(id)] = false;
  }

  for (const r of reactions) {
    const key = String(r.targetId);
    counts[key] = (counts[key] || 0) + 1;
    if (String(r.user) === String(userId)) liked[key] = true;
  }

  return { counts, liked };
};

const formatPost = (post, extras = {}) => {
  const community = post.community;
  return {
    id: post._id,
    title: post.title || "",
    text: post.text || "",
    media: formatMedia(post.media),
    community:
      community && typeof community === "object" && community._id
        ? {
            id: community._id,
            name: community.name,
            coverImage: community.coverImage || "",
          }
        : { id: post.community },
    author: formatUser(post.author),
    likeCount: extras.likeCount ?? 0,
    likedByMe: extras.likedByMe ?? false,
    commentCount: extras.commentCount ?? 0,
    canEdit: extras.canEdit ?? false,
    canDelete: extras.canDelete ?? false,
    isAuthor: extras.isAuthor ?? false,
    isLocked: extras.isLocked ?? false,
    editWindowMinutes: extras.editWindowMinutes ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
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
  return canManagePostsInCommunity(post.community?._id || post.community, user);
};

const userCanDeleteComment = async (comment, user) => {
  const isAuthor = isDocAuthor(comment, user);
  const isAdmin = user.role === "admin";
  if (isAdmin) return true;
  if (isAuthor && (await isWithinEditWindow(comment.createdAt))) return true;
  const post = await Post.findById(comment.post).select("community").lean();
  if (!post) return false;
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
    const joinedIds = await listJoinedCommunityIds(req.user);
    const manageableIds = await listManageableCommunityIds(req.user);

    const filter = {};
    const mineOnly = mine === "1" || mine === "true";

    if (mineOnly) {
      filter.author = req.user._id;
    } else if (communityId) {
      const allowed =
        req.user.role === "admin" ||
        (await canEngageInCommunity(communityId, req.user)) ||
        manageableIds.some((id) => String(id) === String(communityId)) ||
        joinedIds.some((id) => String(id) === String(communityId));

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You cannot view posts in this community.",
        });
      }
      filter.community = communityId;
    } else {
      // Default: posts in communities the user has joined
      if (!joinedIds.length) {
        return res.status(200).json({ success: true, posts: [] });
      }
      filter.community = { $in: joinedIds };
    }

    if (q && String(q).trim()) {
      const term = String(q).trim();
      filter.$or = [
        { title: { $regex: term, $options: "i" } },
        { text: { $regex: term, $options: "i" } },
      ];
    }

    const posts = await Post.find(filter)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage")
      .sort({ createdAt: -1 })
      .lean();

    const postIds = posts.map((p) => p._id);
    const { counts, liked } = await getLikeMeta("post", postIds, req.user._id);

    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);
    const commentMap = Object.fromEntries(
      commentCounts.map((c) => [String(c._id), c.count])
    );

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

    return res.status(200).json({
      success: true,
      posts: postsWithPermission.map(
        ({ post: p, canDelete, isAuthor, canEdit, isLocked }) =>
          formatPost(p, {
            likeCount: counts[String(p._id)] || 0,
            likedByMe: liked[String(p._id)] || false,
            commentCount: commentMap[String(p._id)] || 0,
            canEdit,
            canDelete,
            isAuthor,
            isLocked,
            editWindowMinutes,
          })
      ),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "username name avatar role")
      .populate("community", "name coverImage")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const allowed =
      req.user.role === "admin" ||
      (await canEngageInCommunity(post.community?._id || post.community, req.user)) ||
      (await canCreatePost(post.community?._id || post.community, req.user));

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this post.",
      });
    }

    const { counts, liked } = await getLikeMeta("post", [post._id], req.user._id);
    const commentCount = await Comment.countDocuments({ post: post._id });

    const canDelete = await userCanDeletePost(post, req.user);
    const flags = await buildOwnContentFlags(post, req.user);
    return res.status(200).json({
      success: true,
      post: formatPost(post, {
        likeCount: counts[String(post._id)] || 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount,
        canDelete,
        ...flags,
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const { communityId, title, text, media } = req.body;

    if (!communityId) {
      return res.status(400).json({
        success: false,
        message: "communityId is required.",
      });
    }

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

    const post = await Post.create({
      community: communityId,
      author: req.user._id,
      title: cleanTitle,
      text: cleanText,
      media: mediaList.map((m) => ({
        url: m.url,
        publicId: m.publicId || "",
        type: m.type === "video" ? "video" : "image",
      })),
    });

    await post.populate("author", "username name avatar role");
    await post.populate("community", "name coverImage");

    // await logActivity({
    //   actor: req.user._id,
    //   action: "post.create",
    //   targetType: "post",
    //   targetId: post._id,
    //   meta: { communityId },
    // });

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
    return res.status(500).json({ success: false, message: error.message });
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
    await post.populate("community", "name coverImage");

    const { counts, liked } = await getLikeMeta(
      "post",
      [post._id],
      req.user._id
    );
    const commentCount = await Comment.countDocuments({ post: post._id });
    const flags = await buildOwnContentFlags(post, req.user);

    return res.status(200).json({
      success: true,
      message: "Post updated.",
      post: formatPost(post.toObject(), {
        likeCount: counts[String(post._id)] || 0,
        likedByMe: liked[String(post._id)] || false,
        commentCount,
        canDelete: await userCanDeletePost(post, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    // await logActivity({
    //   actor: req.user._id,
    //   action: "post.delete",
    //   targetType: "post",
    //   targetId: post._id,
    // });

    return res.status(200).json({
      success: true,
      message: "Post deleted.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listComments = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageInCommunity(post.community, req.user)) && req.user.role !== "admin") {
      // Allow owners/mods who manage even if engage check fails oddly
      if (!(await canCreatePost(post.community, req.user))) {
        return res.status(403).json({
          success: false,
          message: "You cannot view comments in this community.",
        });
      }
    }

    const comments = await Comment.find({ post: post._id })
      .populate("author", "username name avatar role")
      .sort({ createdAt: 1 })
      .lean();

    const ids = comments.map((c) => c._id);
    const { counts, liked } = await getLikeMeta("comment", ids, req.user._id);

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
            likeCount: counts[String(c._id)] || 0,
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageInCommunity(post.community, req.user))) {
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
    });

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
    return res.status(500).json({ success: false, message: error.message });
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

    const { counts, liked } = await getLikeMeta(
      "comment",
      [comment._id],
      req.user._id
    );
    const flags = await buildOwnContentFlags(comment, req.user);

    return res.status(200).json({
      success: true,
      comment: formatComment(comment.toObject(), {
        likeCount: counts[String(comment._id)] || 0,
        likedByMe: liked[String(comment._id)] || false,
        canDelete: await userCanDeleteComment(comment, req.user),
        ...flags,
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    await Reaction.deleteMany({
      targetType: "comment",
      targetId: { $in: ids },
    });
    await Comment.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      success: true,
      message: "Comment deleted.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const toggleLike = async (targetType, targetId, user) => {
  const existing = await Reaction.findOne({
    targetType,
    targetId,
    user: user._id,
  });

  if (existing) {
    await existing.deleteOne();
  } else {
    await Reaction.create({ targetType, targetId, user: user._id });
  }

  const likeCount = await Reaction.countDocuments({ targetType, targetId });
  const likedByMe = !existing;

  return { likeCount, likedByMe };
};

export const togglePostLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    if (!(await canEngageInCommunity(post.community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can like posts.",
      });
    }

    const result = await toggleLike("post", post._id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    if (!(await canEngageInCommunity(post.community, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Only community members can like comments.",
      });
    }

    const result = await toggleLike("comment", comment._id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
