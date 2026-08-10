import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  Loader2,
  Heart,
  MessageCircle,
  Reply,
  ChevronDown,
  ChevronUp,
  Flag,
  Users,
} from "lucide-react";
import {
  fetchPost,
  fetchPosts,
  updatePost,
  deletePost,
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
} from "../../../api/posts";
import {
  joinPublicCommunity,
  requestToJoin,
} from "../../../api/communities";
import MediaPicker from "../../../shared/components/media/MediaPicker";
import PostMediaGallery from "../../../shared/components/media/PostMediaGallery";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import EditWindowExpiredModal from "../../../shared/components/modals/EditWindowExpiredModal";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { communitySegment } from "../../../shared/services/entityLinks";

export default function PostDetail({
  postId,
  onBack,
  onDeleted,
  embedded = false,
  compact = false,
  // backLabel = "Back",
  postPathBuilder,
  fetchPostFn = fetchPost,
}) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();

  // Post & Main Comments States
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  // In compact mode the discussion stays collapsed until the comment count is tapped
  const [commentsOpen, setCommentsOpen] = useState(!compact);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentPostsLoading, setRecentPostsLoading] = useState(false);

  // Active reply box target ID (null = main post input, ID = target comment ID)
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [showMainCommentInput, setShowMainCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Expandable Replies State tracking expanded parent comment IDs
  const [expandedReplies, setExpandedReplies] = useState({});

  // Edit / Delete Modals & States
  const [editingComment, setEditingComment] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", text: "", media: [] });
  const [lockModal, setLockModal] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [joining, setJoining] = useState(false);

  // Data Fetching
  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPostFn(postId);
      setPost(data?.post || null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load post.");
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId, fetchPostFn, showToast]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const data = await fetchComments(postId);
      setComments(data?.comments || []);
    } catch (err) {
      const status = err?.response?.status;
      // Guests can view public posts but comments require auth
      if (status === 401 || status === 403) {
        setComments([]);
      } else {
        showToast(err?.response?.data?.message || "Failed to load comments.");
      }
    } finally {
      setCommentsLoading(false);
    }
  }, [postId, showToast]);

  useEffect(() => {
    loadPost();
    setCommentsExpanded(false);
    setCommentsOpen(!compact);
    loadComments();
  }, [loadPost, loadComments, compact]);

  useEffect(() => {
    const communityId = post?.community?.id || post?.community;
    if (!communityId) {
      setRecentPosts([]);
      return;
    }

    let cancelled = false;
    setRecentPostsLoading(true);

    fetchPosts({ communityId })
      .then((data) => {
        if (cancelled) return;
        const sorted = [...(data?.posts || [])]
          .filter((p) => String(p.id) !== String(postId))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentPosts(sorted.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setRecentPosts([]);
      })
      .finally(() => {
        if (!cancelled) setRecentPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [post?.community?.id, post?.community, postId]);

  // Derived Top-Level Comments
  const topLevel = useMemo(
    () => comments.filter((c) => !c.parent),
    [comments]
  );

  const visibleTopLevel = useMemo(
    () => (commentsExpanded ? topLevel : topLevel.slice(0, 3)),
    [topLevel, commentsExpanded]
  );

  const getReplies = (parentId) =>
    comments.filter((c) => String(c.parent) === String(parentId));

  // Toggle display of replies
  const toggleRepliesExpand = (parentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  // Actions
  const showContentLockModal = (item, target) => {
    setLockModal({
      target,
      editWindowMinutes: item?.editWindowMinutes ?? post?.editWindowMinutes ?? 60,
    });
  };

  const openEdit = () => {
    if (!post) return;
    if (!post.canEdit) {
      if (post.isAuthor || post.isLocked) {
        showContentLockModal(post, "post");
      }
      return;
    }
    setForm({
      title: post.title || "",
      text: post.text || "",
      media: post.media || [],
    });
    setShowEdit(true);
  };

  const openDeletePost = () => {
    if (!post) return;
    if (!post.canDelete) {
      if (post.isAuthor || post.isLocked) {
        showContentLockModal(post, "post");
      }
      return;
    }
    setShowDelete(true);
  };

  const openEditComment = (comment) => {
    if (!comment) return;
    if (!comment.canEdit) {
      if (comment.isAuthor || comment.isLocked) {
        showContentLockModal(comment, "comment");
      }
      return;
    }
    setEditingComment({
      id: comment.id,
      text: comment.text,
    });
  };

  const openDeleteComment = (comment) => {
    if (!comment) return;
    if (!comment.canDelete) {
      if (comment.isAuthor || comment.isLocked) {
        showContentLockModal(comment, "comment");
      }
      return;
    }
    setDeleteCommentId(comment.id);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const data = await updatePost(postId, {
        title: form.title.trim(),
        text: form.text.trim(),
        media: form.media,
      });
      setPost(data.post);
      setShowEdit(false);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update post.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deletePost(postId);
      setShowDelete(false);
      if (onDeleted) onDeleted();
      else if (onBack) onBack();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete post.");
    } finally {
      setSaving(false);
    }
  };

  const handleLikePost = async () => {
    if (!post) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!post.canEngage) {
      showToast(
        post.community
          ? "Join this community to like posts."
          : "You cannot like this post."
      );
      return;
    }
    const prev = { ...post };
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likedByMe
        ? Math.max(0, (post.likeCount || 0) - 1)
        : (post.likeCount || 0) + 1,
    });
    try {
      const data = await togglePostLike(post.id);
      setPost((p) => ({
        ...p,
        likedByMe: data.likedByMe,
        likeCount: data.likeCount,
      }));
    } catch (err) {
      setPost(prev);
      showToast(err?.response?.data?.message || "Failed to like post.");
    }
  };

  const submitComment = async (parentId = null) => {
    const text = commentText.trim();
    if (!text) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!post?.canEngage) {
      showToast(
        post?.community
          ? "Join this community to comment."
          : "You cannot comment on this post."
      );
      return;
    }
    try {
      const data = await createComment(postId, {
        text,
        parentId: parentId || undefined,
      });
      setComments((list) => [...list, data.comment]);
      setCommentText("");
      setReplyTargetId(null);
      setShowMainCommentInput(false);

      // Auto expand replies for parent when replied
      if (parentId) {
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      }

      setPost((p) =>
        p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to comment.");
    }
  };

  const handleLikeComment = async (comment) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!post?.canEngage) {
      showToast(
        post?.community
          ? "Join this community to like comments."
          : "You cannot like this comment."
      );
      return;
    }
    const prev = comments;
    setComments((list) =>
      list.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              likedByMe: !c.likedByMe,
              likeCount: c.likedByMe
                ? Math.max(0, (c.likeCount || 0) - 1)
                : (c.likeCount || 0) + 1,
            }
          : c
      )
    );
    try {
      const data = await toggleCommentLike(comment.id);
      setComments((list) =>
        list.map((c) =>
          c.id === comment.id
            ? { ...c, likedByMe: data.likedByMe, likeCount: data.likeCount }
            : c
        )
      );
    } catch {
      setComments(prev);
    }
  };

  const saveCommentEdit = async () => {
    if (!editingComment) return;
    try {
      const data = await updateComment(editingComment.id, {
        text: editingComment.text.trim(),
      });
      setComments((list) =>
        list.map((c) => (c.id === editingComment.id ? data.comment : c))
      );
      setEditingComment(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to edit comment.");
    }
  };

  const removeComment = async (commentId) => {
    const prev = comments;
    setComments((list) =>
      list.filter(
        (c) => c.id !== commentId && String(c.parent) !== String(commentId)
      )
    );
    try {
      await deleteComment(commentId);
      setDeleteCommentId(null);
      await loadComments();
      await loadPost();
    } catch (err) {
      setComments(prev);
      showToast(err?.response?.data?.message || "Failed to delete comment.");
    }
  };

  // Edit: author within window, or locked author (popup). Never for mods on others.
  // Delete: author within window, locked author (popup), or community moderator.
  const canShowEdit = (item) =>
    Boolean(item?.canEdit || (item?.isAuthor && item?.isLocked));
  const canShowDelete = (item) =>
    Boolean(item?.canDelete || (item?.isAuthor && item?.isLocked));

  const showPostEdit = canShowEdit(post);
  const showPostDelete = canShowDelete(post);
  const showPostActions = showPostEdit || showPostDelete;
  const currentUserId = String(user?.id || user?._id || "");
  const canReportPost =
    isAuthenticated &&
    post &&
    currentUserId &&
    String(post.author?.id || post.author?._id || "") !== currentUserId;
  const canReportComment = (comment) =>
    Boolean(
      isAuthenticated &&
        currentUserId &&
        comment &&
        String(comment.author?.id || comment.author?._id || "") !==
          currentUserId
    );

  const needsCommunityJoin =
    Boolean(post?.community?.id || post?.community) &&
    isAuthenticated &&
    post?.canEngage === false;

  const communityPath = post?.community
    ? `/dashboard/communities/${communitySegment(post.community) || post.community.id}`
    : null;

  const handleJoinCommunity = async () => {
    const communityId = post?.community?.id || post?.community;
    if (!communityId || joining) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setJoining(true);
    try {
      const type = post.community?.type;
      if (type === "private_request") {
        await requestToJoin(communityId, {});
        showToast("Join request sent.");
      } else {
        await joinPublicCommunity(communityId);
        showToast("Joined community.");
        await loadPost();
        await loadComments();
      }
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Could not join this community."
      );
    } finally {
      setJoining(false);
    }
  };

  const renderAvatar = (author, size = "md") => {
    const name = author?.name || author?.username || "Member";
    const initial = name.charAt(0).toUpperCase();
    const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

    if (author?.avatar) {
      return (
        <img
          src={author.avatar}
          alt=""
          className={`${sizeClass} rounded-full object-cover border border-[#2A241E] shrink-0`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-semibold shrink-0`}
      >
        {initial}
      </div>
    );
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#A69B8D] text-sm gap-2 w-full">
        <Loader2 size={18} className="animate-spin text-[#D4AF37]" />
        Loading post...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 py-6">
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center text-[#8C8070] text-sm">
          Post not found.
        </div>
      </div>
    );
  }

  const communityId = post.community?.id || post.community;
  const hasCommunity = Boolean(communityId);

  const sidebarCard = hasCommunity ? (
    <div className="bg-[#14100D] rounded-xl p-5 space-y-4 shadow-xl">
      <h3 className="text-sm font-serif font-semibold text-[#E5E0D8] border-b border-[#2A241E] pb-3">
        Recent Posts
      </h3>
      {recentPostsLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8070] py-2">
          <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
          Loading...
        </div>
      ) : recentPosts.length === 0 ? (
        <p className="text-xs text-[#8C8070]">
          No other posts for this community.
        </p>
      ) : (
        <div className="space-y-3">
          {recentPosts.map((recentPost) => {
            const authorName =
              recentPost.author?.name ||
              recentPost.author?.username ||
              "Member";
            const coverImage = recentPost.media?.find((m) => m.type === "image");

            return (
              <div
                key={recentPost.id}
                className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  {renderAvatar(recentPost.author, "sm")}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#E5E0D8] truncate">
                      {authorName}
                    </div>
                    {recentPost.author?.username && (
                      <div className="text-[10px] text-[#A69B8D] truncate">
                        @{recentPost.author.username}
                      </div>
                    )}
                    <div className="text-[10px] text-[#8C8070] mt-0.5">
                      {timeAgo(recentPost.createdAt)}
                    </div>
                  </div>
                  {coverImage && (
                    <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-[#14100D] border border-[#2A241E]">
                      <img
                        src={coverImage.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const path = postPathBuilder
                        ? postPathBuilder(recentPost.id)
                        : `/dashboard/communities/${communityId}/posts/${recentPost.id}`;
                      navigate(path);
                    }}
                    className="text-[10px] font-medium text-[#D4AF37] hover:text-[#c3a030] transition-colors"
                  >
                    Details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  const postActions = showPostActions ? (
    <div className="shrink-0 flex items-center gap-2 rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-1.5">
      {showPostEdit && (
        <button
          type="button"
          onClick={openEdit}
          title="Edit Post"
          className="p-2 rounded-md text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#2A241E]/50 transition-all"
        >
          <Pencil size={16} />
        </button>
      )}
      {showPostDelete && (
        <button
          type="button"
          onClick={openDeletePost}
          title="Delete Post"
          className="p-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  ) : null;

  const authorBlock = (
    <div
      className={`flex items-center gap-3 ${
        compact ? "min-w-0" : "py-2 border-y border-[#2A241E]/40"
      }`}
    >
      {renderAvatar(post.author, compact ? "sm" : "md")}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#E5E0D8] truncate">
          {post.author?.name || post.author?.username || "Member"}
        </div>
        {post.author?.username && (
          <div className="text-[11px] text-[#A69B8D] truncate">
            @{post.author.username}
          </div>
        )}
        <div className="text-[11px] text-[#8C8070]">
          {compact
            ? timeAgo(post.createdAt)
            : post.createdAt
            ? new Date(post.createdAt).toLocaleString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : ""}
        </div>
      </div>
    </div>
  );

  const titleBlock = (
    <div className={compact ? "space-y-1 min-w-0" : "space-y-2 min-w-0"}>
      {post.community?.name && (
        communityPath ? (
          <Link
            to={communityPath}
            className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono hover:text-[#e0c04a]"
          >
            {post.community.name}
          </Link>
        ) : (
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono">
            {post.community.name}
          </p>
        )
      )}
      <h1
        className={`font-serif font-bold text-[#E5E0D8] leading-tight ${
          compact
            ? "text-base sm:text-lg"
            : "text-2xl sm:text-3xl lg:text-4xl"
        }`}
      >
        {post.title || "Untitled"}
      </h1>
    </div>
  );

  const commentsVisible = !compact || commentsOpen;
  const mainInputVisible = compact ? commentsOpen : showMainCommentInput;

  const mainContent = (
    <>
      {/* {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </button>
      )} */}

      <div className="w-full max-w-full">
        <article
          className={`bg-[#14100D] overflow-hidden w-full shadow-xl ${
            compact ? "rounded-lg" : "rounded-xl"
          }`}
        >
          <div className={compact ? "p-4 space-y-3" : "p-5 sm:p-8 space-y-6"}>
            {compact ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  {authorBlock}
                  {postActions}
                </div>
                {titleBlock}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  {titleBlock}
                  {postActions}
                </div>
                {authorBlock}
              </>
            )}

            {post.media && post.media.length > 0 && (
              <div
                className={`relative w-full bg-[#0A0806] flex items-center justify-center rounded-lg overflow-hidden group ${
                  compact ? "max-h-[40vh]" : "min-h-[250px] max-h-[70vh]"
                }`}
              >
                <div
                  className={`w-full h-full flex items-center justify-center ${
                    compact ? "" : "p-2"
                  }`}
                >
                  <PostMediaGallery
                    media={post.media}
                    counterOverlay
                    heightClass={compact ? "max-h-[36vh]" : "max-h-96"}
                  />
                </div>
              </div>
            )}

            {post.text && (
              <p
                className={
                  compact
                    ? "text-sm text-[#C9C0B4] whitespace-pre-wrap leading-relaxed"
                    : "text-sm sm:text-base text-[#C9C0B4] whitespace-pre-wrap leading-relaxed font-serif first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-serif first-letter:text-5xl sm:first-letter:text-6xl first-letter:leading-[0.8] first-letter:text-[#D4AF37]"
                }
              >
                {post.text}
              </p>
            )}

            {needsCommunityJoin ? (
              <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 space-y-2">
                <p className="text-xs text-[#E5E0D8]">
                  Join{" "}
                  <span className="text-[#D4AF37] font-medium">
                    {post.community?.name || "this community"}
                  </span>{" "}
                  to like and comment.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={joining}
                    onClick={handleJoinCommunity}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-50"
                  >
                    {joining ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Users size={12} />
                    )}
                    {post.community?.type === "private_request"
                      ? "Request to join"
                      : "Join community"}
                  </button>
                  {communityPath ? (
                    <Link
                      to={communityPath}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8]"
                    >
                      View community
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              className={`flex items-center gap-6 border-t border-[#2A241E]/60 ${
                compact ? "pt-3" : "pt-4"
              }`}
            >
              <button
                type="button"
                onClick={handleLikePost}
                className={`inline-flex items-center gap-2 text-xs font-medium transition-colors ${
                  post.likedByMe
                    ? "text-[#D4AF37]"
                    : "text-[#A69B8D] hover:text-[#E5E0D8]"
                }`}
              >
                <Heart
                  size={16}
                  className={post.likedByMe ? "fill-current" : ""}
                />
                <span>{post.likeCount || 0} Likes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReplyTargetId(null);
                  setCommentText("");
                  if (compact) {
                    setCommentsOpen((prev) => !prev);
                  } else {
                    setShowMainCommentInput((prev) => !prev);
                  }
                }}
                aria-expanded={compact ? commentsOpen : showMainCommentInput}
                className={`inline-flex items-center gap-2 text-xs font-medium transition-colors ${
                  (compact ? commentsOpen : showMainCommentInput)
                    ? "text-[#D4AF37]"
                    : "text-[#A69B8D] hover:text-[#E5E0D8]"
                }`}
              >
                <MessageCircle size={16} />
                <span>{post.commentCount || comments.length || 0} Comments</span>
              </button>

              {canReportPost ? (
                <button
                  type="button"
                  onClick={() =>
                    setReportTarget({
                      type: "post",
                      id: post.id,
                      label: post.title || "this post",
                    })
                  }
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#A69B8D] hover:text-red-400 transition-colors ml-auto"
                  title="Report post"
                >
                  <Flag size={15} />
                  <span>Report</span>
                </button>
              ) : null}
            </div>
          </div>
        </article>
      </div>

      {commentsVisible && (
      <section
        className={`bg-[#14100D] shadow-xl ${
          compact
            ? "rounded-lg p-4 space-y-4"
            : "rounded-xl p-5 sm:p-8 space-y-6"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b border-[#2A241E] ${
            compact ? "pb-3" : "pb-4"
          }`}
        >
          <h2
            className={`font-serif font-semibold text-[#E5E0D8] ${
              compact ? "text-base" : "text-lg sm:text-xl"
            }`}
          >
            Discussion{" "}
            <span className="text-[#A69B8D] font-sans text-xs sm:text-sm">
              ({post.commentCount || comments.length || 0})
            </span>
          </h2>
          {!commentsLoading &&
            topLevel.length > 3 &&
            !commentsExpanded && (
              <button
                type="button"
                onClick={() => setCommentsExpanded(true)}
                className="text-xs text-[#D4AF37] hover:text-[#c3a030] transition-colors shrink-0"
              >
                View all comments
              </button>
            )}
        </div>

        {/* Main Comment Input Box (Slow Reveal Transition) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            mainInputVisible
              ? `max-h-60 opacity-100 ${compact ? "mb-4" : "mb-6"}`
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-4 space-y-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="Write a comment..."
              className="w-full bg-transparent text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMainCommentInput(false);
                  if (compact) setCommentsOpen(false);
                  setCommentText("");
                }}
                className="px-3.5 py-2 rounded-lg text-xs text-[#A69B8D] hover:text-[#E5E0D8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitComment(null)}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold hover:bg-[#c3a030] transition-colors"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        {commentsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#8C8070] py-4">
            <Loader2 size={14} className="animate-spin text-[#D4AF37]" />{" "}
            Loading comments...
          </div>
        ) : topLevel.length === 0 ? (
          <p className="text-xs text-[#8C8070] py-4">No comments yet.</p>
        ) : (
          <div className="space-y-6">
            {visibleTopLevel.map((comment) => {
              const replies = getReplies(comment.id);
              const isExpanded = !!expandedReplies[comment.id];
              const isReplyingHere = replyTargetId === comment.id;

              return (
                <div key={comment.id} className="space-y-3">
                  {/* Parent Comment Item */}
                  <div className="py-2">
                    {editingComment?.id === comment.id ? (
                      <div className="space-y-3 bg-[#0E0C0A] p-3 rounded-lg border border-[#2A241E]">
                        <textarea
                          value={editingComment.text}
                          onChange={(e) =>
                            setEditingComment((p) => ({
                              ...p,
                              text: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full bg-[#14100D] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingComment(null)}
                            className="px-3 py-1.5 rounded border border-[#2A241E] text-[11px] text-[#A69B8D] hover:text-[#E5E0D8]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveCommentEdit}
                            className="px-3.5 py-1.5 rounded bg-[#D4AF37] text-[#0E0C0A] text-[11px] font-bold hover:bg-[#c3a030]"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {renderAvatar(comment.author, "sm")}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Header info */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#E5E0D8]">
                                {comment.author?.name ||
                                  comment.author?.username ||
                                  "Member"}
                              </span>
                              <span className="text-[11px] text-[#8C8070]">
                                {timeAgo(comment.createdAt)}
                              </span>
                              {comment.author?.role && (
                                <span className="text-[9px] uppercase tracking-wider bg-[#D4AF37]/15 text-[#D4AF37] px-1.5 py-0.5 rounded font-mono border border-[#D4AF37]/30">
                                  {comment.author.role}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {canReportComment(comment) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportTarget({
                                      type: "comment",
                                      id: comment.id,
                                      label: "this comment",
                                    })
                                  }
                                  className="text-[#8C8070] hover:text-red-400 transition-colors p-1"
                                  title="Report comment"
                                >
                                  <Flag size={12} />
                                </button>
                              )}
                              {(canShowEdit(comment) ||
                                canShowDelete(comment)) && (
                                <>
                                  {canShowEdit(comment) && (
                                    <button
                                      type="button"
                                      onClick={() => openEditComment(comment)}
                                      className="text-[#8C8070] hover:text-[#D4AF37] transition-colors p-1"
                                      title="Edit comment"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                  {canShowDelete(comment) && (
                                    <button
                                      type="button"
                                      onClick={() => openDeleteComment(comment)}
                                      className="text-[#8C8070] hover:text-red-400 transition-colors p-1"
                                      title="Delete comment"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-[#C9C0B4] leading-relaxed">
                            {comment.text}
                          </p>

                          {/* Action Controls Below Comment */}
                          <div className="flex items-center gap-4 pt-1 text-[11px] text-[#A69B8D]">
                            <button
                              type="button"
                              onClick={() => handleLikeComment(comment)}
                              className={`inline-flex items-center gap-1.5 hover:text-[#E5E0D8] transition-colors ${
                                comment.likedByMe
                                  ? "text-[#D4AF37] font-semibold"
                                  : ""
                              }`}
                            >
                              <Heart
                                size={13}
                                className={
                                  comment.likedByMe
                                    ? "fill-current text-[#D4AF37]"
                                    : ""
                                }
                              />
                              <span>{comment.likeCount || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowMainCommentInput(false);
                                if (isReplyingHere) {
                                  setReplyTargetId(null);
                                  setCommentText("");
                                } else {
                                  setReplyTargetId(comment.id);
                                  setCommentText("");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors"
                            >
                              <Reply size={13} />
                              <span>Reply</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inline Reply Input directly under comment (Slow animation reveal) */}
                  <div
                    className={`ml-6 sm:ml-10 overflow-hidden transition-all duration-300 ease-in-out ${
                      isReplyingHere
                        ? "max-h-60 opacity-100 my-2"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={2}
                        placeholder={`Reply to ${
                          comment.author?.name || "member"
                        }...`}
                        className="w-full bg-transparent text-xs text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none resize-y"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTargetId(null);
                            setCommentText("");
                          }}
                          className="px-3 py-1 rounded text-[11px] text-[#A69B8D] hover:text-[#E5E0D8]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => submitComment(comment.id)}
                          className="px-3 py-1 rounded bg-[#D4AF37] text-[#0E0C0A] text-[11px] font-bold hover:bg-[#c3a030]"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* View/Hide Replies Trigger */}
                  {replies.length > 0 && (
                    <div className="ml-6 sm:ml-10 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleRepliesExpand(comment.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] font-medium hover:underline focus:outline-none"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={14} />
                            Hide replies
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            View {replies.length}{" "}
                            {replies.length === 1 ? "reply" : "replies"}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Expanded Replies Wrapper with smooth transition */}
                  <div
                    className={`ml-6 sm:ml-10 border-l border-[#2A241E] pl-4 sm:pl-6 space-y-3 overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded
                        ? "max-h-[2000px] opacity-100 mt-2"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    {replies.map((reply) => {
                      const isReplyingToReply = replyTargetId === reply.id;

                      return (
                        <div key={reply.id} className="py-2 space-y-2">
                          {editingComment?.id === reply.id ? (
                            <div className="space-y-3 bg-[#0E0C0A] p-3 rounded-lg border border-[#2A241E]">
                              <textarea
                                value={editingComment.text}
                                onChange={(e) =>
                                  setEditingComment((p) => ({
                                    ...p,
                                    text: e.target.value,
                                  }))
                                }
                                rows={2}
                                className="w-full bg-[#14100D] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingComment(null)}
                                  className="px-3 py-1.5 rounded border border-[#2A241E] text-[11px] text-[#A69B8D] hover:text-[#E5E0D8]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={saveCommentEdit}
                                  className="px-3.5 py-1.5 rounded bg-[#D4AF37] text-[#0E0C0A] text-[11px] font-bold hover:bg-[#c3a030]"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              {renderAvatar(reply.author, "sm")}
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-[#E5E0D8]">
                                      {reply.author?.name ||
                                        reply.author?.username ||
                                        "Member"}
                                    </span>
                                    <span className="text-[11px] text-[#8C8070]">
                                      {timeAgo(reply.createdAt)}
                                    </span>
                                    {reply.author?.role && (
                                      <span className="text-[9px] uppercase tracking-wider bg-[#D4AF37]/15 text-[#D4AF37] px-1.5 py-0.5 rounded font-mono border border-[#D4AF37]/30">
                                        {reply.author.role}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {canReportComment(reply) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReportTarget({
                                            type: "comment",
                                            id: reply.id,
                                            label: "this reply",
                                          })
                                        }
                                        className="text-[#8C8070] hover:text-red-400 transition-colors p-1"
                                        title="Report reply"
                                      >
                                        <Flag size={12} />
                                      </button>
                                    )}
                                    {(canShowEdit(reply) ||
                                      canShowDelete(reply)) && (
                                      <>
                                        {canShowEdit(reply) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openEditComment(reply)
                                            }
                                            className="text-[#8C8070] hover:text-[#D4AF37] transition-colors p-1"
                                            title="Edit reply"
                                          >
                                            <Pencil size={12} />
                                          </button>
                                        )}
                                        {canShowDelete(reply) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openDeleteComment(reply)
                                            }
                                            className="text-[#8C8070] hover:text-red-400 transition-colors p-1"
                                            title="Delete reply"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs sm:text-sm text-[#C9C0B4] leading-relaxed">
                                  {reply.text}
                                </p>

                                <div className="flex items-center gap-4 pt-1 text-[11px] text-[#A69B8D]">
                                  <button
                                    type="button"
                                    onClick={() => handleLikeComment(reply)}
                                    className={`inline-flex items-center gap-1.5 hover:text-[#E5E0D8] transition-colors ${
                                      reply.likedByMe
                                        ? "text-[#D4AF37] font-semibold"
                                        : ""
                                    }`}
                                  >
                                    <Heart
                                      size={13}
                                      className={
                                        reply.likedByMe
                                          ? "fill-current text-[#D4AF37]"
                                          : ""
                                      }
                                    />
                                    <span>{reply.likeCount || 0}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isReplyingToReply) {
                                        setReplyTargetId(null);
                                        setCommentText("");
                                      } else {
                                        setReplyTargetId(reply.id);
                                        setCommentText("");
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors"
                                  >
                                    <Reply size={13} />
                                    <span>Reply</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Nested Input below reply item */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isReplyingToReply
                                ? "max-h-60 opacity-100 my-2"
                                : "max-h-0 opacity-0 pointer-events-none"
                            }`}
                          >
                            <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 space-y-2">
                              <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                rows={2}
                                placeholder={`Reply to ${
                                  reply.author?.name || "member"
                                }...`}
                                className="w-full bg-transparent text-xs text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none resize-y"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTargetId(null);
                                    setCommentText("");
                                  }}
                                  className="px-3 py-1 rounded text-[11px] text-[#A69B8D] hover:text-[#E5E0D8]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitComment(comment.id)}
                                  className="px-3 py-1 rounded bg-[#D4AF37] text-[#0E0C0A] text-[11px] font-bold hover:bg-[#c3a030]"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </section>
      )}
      {!embedded && sidebarCard && <div className="lg:hidden">{sidebarCard}</div>}
    </>
  );

  return (
    <div
      className={
        compact
          ? "w-full p-3 sm:p-4"
          : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
      }
    >
      {embedded || !sidebarCard ? (
        <div className={compact ? "space-y-3" : "space-y-6"}>{mainContent}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start">
          <div className="min-w-0 space-y-6">{mainContent}</div>
          <aside className="hidden lg:block lg:sticky lg:top-6">
            {sidebarCard}
          </aside>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowEdit(false)}
          />
          <form
            onSubmit={handleSaveEdit}
            className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#14100D] border border-[#2A241E] rounded-t-xl sm:rounded-xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#2A241E]">
              <h2 className="text-lg font-semibold text-[#E5E0D8]">
                Edit Post
              </h2>
              <button type="button" onClick={() => setShowEdit(false)}>
                <X size={18} className="text-[#A69B8D] hover:text-[#E5E0D8]" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070]">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                required
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070]">
                Description
              </label>
              <textarea
                value={form.text}
                onChange={(e) =>
                  setForm((p) => ({ ...p, text: e.target.value }))
                }
                rows={4}
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
              />
            </div>
            <div>
              <MediaPicker
                media={form.media}
                onChange={(media) => setForm((p) => ({ ...p, media }))}
                onError={showToast}
                label="Media"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Delete Modals */}
      <ConfirmDeleteModal
        open={showDelete}
        title="Delete post?"
        variant="post"
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      >
        This cannot be undone. Comments and likes associated with this post will
        also be permanently removed.
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={Boolean(deleteCommentId)}
        title="Delete comment?"
        variant="post"
        onConfirm={() => removeComment(deleteCommentId)}
        onClose={() => setDeleteCommentId(null)}
      >
        This cannot be undone. Any nested replies under this comment will also
        be removed.
      </ConfirmDeleteModal>

      <EditWindowExpiredModal
        open={Boolean(lockModal)}
        onClose={() => setLockModal(null)}
        title="Time's up"
        message={
          lockModal?.target === "comment"
            ? "You can no longer edit or delete this comment."
            : "You can no longer edit or delete this post."
        }
        editWindowMinutes={lockModal?.editWindowMinutes}
      />

      <ReportContentModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type || "post"}
        targetId={reportTarget?.id}
        targetLabel={reportTarget?.label}
      />
    </div>
  );
}