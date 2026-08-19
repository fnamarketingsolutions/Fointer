import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuLoaderCircle as Loader2,
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuFlag as Flag,
  LuUsers as Users
} from "react-icons/lu";
import {
  fetchPost,
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
import PostMediaGallery from "../../../shared/components/media/PostMediaGallery";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import EditWindowExpiredModal from "../../../shared/components/modals/EditWindowExpiredModal";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";
import PostAuthorAvatar from "../components/PostAuthorAvatar";
import PostCommentsSection from "../components/PostCommentsSection";
import PostEditModal from "../components/PostEditModal";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { communitySegment } from "../../../shared/services/entityLinks";
import { timeAgo } from "../../../shared/utils/date";

export default function PostDetail({
  postId,
  onBack,
  onDeleted,
  embedded = false,
  compact = false,
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
    if (!postId) {
      setPost(null);
      setLoading(false);
      setComments([]);
      return;
    }
    loadPost();
    setCommentsExpanded(false);
    setCommentsOpen(!compact);
    loadComments();
  }, [loadPost, loadComments, compact, postId]);

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
    ? `/communities/${communitySegment(post.community) || post.community.id}`
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
      <PostAuthorAvatar author={post.author} size={compact ? "sm" : "md"} />
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
          <div
            className={
              compact || embedded
                ? "p-3 sm:p-5 space-y-3 sm:space-y-4"
                : "p-5 sm:p-8 space-y-6"
            }
          >
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

      <PostCommentsSection
        visible={commentsVisible}
        compact={compact}
        post={post}
        comments={comments}
        commentsLoading={commentsLoading}
        commentsExpanded={commentsExpanded}
        setCommentsExpanded={setCommentsExpanded}
        topLevel={topLevel}
        visibleTopLevel={visibleTopLevel}
        getReplies={getReplies}
        expandedReplies={expandedReplies}
        toggleRepliesExpand={toggleRepliesExpand}
        replyTargetId={replyTargetId}
        setReplyTargetId={setReplyTargetId}
        showMainCommentInput={showMainCommentInput}
        setShowMainCommentInput={setShowMainCommentInput}
        commentText={commentText}
        setCommentText={setCommentText}
        mainInputVisible={mainInputVisible}
        editingComment={editingComment}
        setEditingComment={setEditingComment}
        submitComment={submitComment}
        saveCommentEdit={saveCommentEdit}
        handleLikeComment={handleLikeComment}
        openEditComment={openEditComment}
        openDeleteComment={openDeleteComment}
        canShowEdit={canShowEdit}
        canShowDelete={canShowDelete}
        canReportComment={canReportComment}
        setReportTarget={setReportTarget}
        setCommentsOpen={setCommentsOpen}
      />
    </>
  );

  return (
    <div
      className={
        compact || embedded
          ? "w-full"
          : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
      }
    >
      <div className={compact || embedded ? "space-y-3" : "space-y-6"}>{mainContent}</div>

      <PostEditModal
        open={showEdit}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setShowEdit(false)}
        onSubmit={handleSaveEdit}
        showToast={showToast}
      />

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