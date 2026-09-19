import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuFlag as Flag,
  LuGlobe as Globe,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuUsers as Users,
} from "react-icons/lu";
import {
  fetchPost,
  fetchTrendingTopics,
  updatePost,
  deletePost,
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
  togglePostLike,
  togglePostReshare,
  toggleCommentLike,
} from "../../../api/posts";
import {
  fetchBrowsableCommunities,
  joinPublicCommunity,
  requestToJoin,
} from "../../../api/communities";
import { fetchChannels } from "../../../api/channels";
import PostMediaGallery from "../../../shared/components/media/PostMediaGallery";
import PostActions from "../../../shared/components/PostActions";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import EditWindowExpiredModal from "../../../shared/components/modals/EditWindowExpiredModal";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";
import PostAuthorAvatar from "../components/PostAuthorAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import PostCommentsSection from "../components/PostCommentsSection";
import PostEditModal from "../components/PostEditModal";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { communitySegment } from "../../../shared/services/entityLinks";
import { timeAgo } from "../../../shared/utils/date";
import { scrollAppToTop } from "../../../shared/utils/scroll";
import { EXPLORE_PATH, FEED_PATH } from "../../../shared/constants/paths";
import {
  FeedDesktopRail,
  FeedFooterRail,
  OtherCommunitiesCard,
  WhatsHappeningCard,
} from "../../communities/pages/dashboard/FeedRail";

export default function PostDetail({
  postId,
  onBack,
  onDeleted,
  embedded = false,
  compact = false,
  fetchPostFn = fetchPost,
  backLabel = "Back",
  showRail,
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
  const includeRail = showRail ?? !compact;
  const isGuest = !isAuthenticated;
  const feedHome = isGuest ? EXPLORE_PATH : FEED_PATH;

  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(includeRail);
  const [otherCommunities, setOtherCommunities] = useState([]);
  const [otherCommunitiesLoading, setOtherCommunitiesLoading] =
    useState(includeRail);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(includeRail);

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

  useLayoutEffect(() => {
    if (postId) scrollAppToTop();
  }, [postId]);

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

  useEffect(() => {
    if (!includeRail) return undefined;
    let cancelled = false;
    (async () => {
      setChannelsLoading(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) setChannels(data?.channels || data?.data || []);
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeRail]);

  useEffect(() => {
    if (!includeRail) return undefined;
    let cancelled = false;
    (async () => {
      setOtherCommunitiesLoading(true);
      try {
        const data = await fetchBrowsableCommunities({
          limit: 6,
          sortBy: "members",
        });
        if (!cancelled) setOtherCommunities(data?.communities || []);
      } catch {
        if (!cancelled) setOtherCommunities([]);
      } finally {
        if (!cancelled) setOtherCommunitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeRail]);

  useEffect(() => {
    if (!includeRail) return undefined;
    let cancelled = false;
    (async () => {
      setTrendingLoading(true);
      try {
        const data = await fetchTrendingTopics({ limit: 10 });
        if (!cancelled) setTrendingTopics(data?.topics || []);
      } catch {
        if (!cancelled) setTrendingTopics([]);
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeRail]);

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

  const handleResharePost = async () => {
    if (!post) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!post.canEngage) {
      showToast(
        post.community
          ? "Join this community to repost."
          : "You cannot repost this."
      );
      return;
    }
    const prev = { ...post };
    setPost({
      ...post,
      resharedByMe: !post.resharedByMe,
      reshareCount: post.resharedByMe
        ? Math.max(0, (post.reshareCount || 0) - 1)
        : (post.reshareCount || 0) + 1,
    });
    try {
      const data = await togglePostReshare(post.id);
      setPost((p) => ({
        ...p,
        resharedByMe: data.resharedByMe,
        reshareCount: data.reshareCount,
      }));
    } catch (err) {
      setPost(prev);
      showToast(err?.response?.data?.message || "Failed to repost.");
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

  const railProps = {
    channels,
    channelsLoading,
    selectedChannel: "",
    onSelectChannel: (name) => {
      navigate(
        name
          ? `${feedHome}?channel=${encodeURIComponent(name)}`
          : feedHome
      );
    },
    communities: otherCommunities,
    communitiesLoading: otherCommunitiesLoading,
    trendingTopics,
    trendingLoading,
  };

  const shellClass = includeRail
    ? "w-full max-w-[1180px] mx-auto"
    : compact || embedded
      ? "w-full"
      : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6";

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-9 px-1 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
    >
      <ArrowLeft size={16} />
      {backLabel}
    </button>
  ) : null;

  const desktopRail = includeRail ? (
    <div className="hidden lg:block lg:sticky lg:top-5">
      <FeedDesktopRail {...railProps} isGuest={isGuest} />
    </div>
  ) : null;

  const mobileRail = includeRail ? (
    <div className="lg:hidden pt-1 space-y-3">
      <WhatsHappeningCard
        topics={trendingTopics}
        loading={trendingLoading}
      />
      <OtherCommunitiesCard
        communities={otherCommunities}
        loading={otherCommunitiesLoading}
      />
      <FeedFooterRail isGuest={isGuest} />
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={shellClass}>
        {backButton ? <div className="mb-3">{backButton}</div> : null}
        <div
          className={
            includeRail
              ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start"
              : ""
          }
        >
          <div className="flex items-center justify-center py-20 text-fo-muted text-sm gap-2 w-full">
            <Loader2 size={18} className="animate-spin text-fo-accent" />
            Loading post...
          </div>
          {desktopRail}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className={shellClass}>
        {backButton ? <div className="mb-3">{backButton}</div> : null}
        <div
          className={
            includeRail
              ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start"
              : ""
          }
        >
          <div className="border border-dashed border-fo-border rounded-xl py-12 text-center text-fo-subtle text-sm">
            Post not found.
          </div>
          {desktopRail}
        </div>
      </div>
    );
  }

  const postActions = showPostActions ? (
    <div className="shrink-0 flex items-center gap-1">
      {showPostEdit && (
        <button
          type="button"
          onClick={openEdit}
          title="Edit Post"
          className="p-2 rounded-lg text-fo-muted hover:text-fo-accent hover:bg-fo-surface-hover transition-colors"
        >
          <Pencil size={16} />
        </button>
      )}
      {showPostDelete && (
        <button
          type="button"
          onClick={openDeletePost}
          title="Delete Post"
          className="p-2 rounded-lg text-fo-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  ) : null;

  const communityName = post.community?.name;
  const VisibilityIcon = communityName ? Users : Globe;

  const authorBlock = (
    <div className="flex items-start gap-3 min-w-0">
      <PostAuthorAvatar author={post.author} size="sm" />
      <div className="min-w-0 flex-1">
        <UserProfileLink
          author={post.author}
          className="text-sm font-semibold text-fo-text truncate block hover:text-fo-accent transition-colors"
        >
          {post.author?.name || post.author?.username || "Member"}
        </UserProfileLink>
        <div className="flex items-center gap-1 text-xs text-fo-subtle flex-wrap">
          {post.author?.username ? (
            <UserProfileLink
              author={post.author}
              className="hover:text-fo-accent transition-colors"
            >
              @{String(post.author.username).replace(/^@+/, "")}
            </UserProfileLink>
          ) : null}
          {post.author?.username ? <span aria-hidden>·</span> : null}
          <span>{timeAgo(post.createdAt)}</span>
          <span aria-hidden>·</span>
          {communityPath ? (
            <Link
              to={communityPath}
              className="inline-flex items-center gap-1 hover:text-fo-accent transition-colors"
            >
              <VisibilityIcon size={11} aria-hidden />
              {communityName}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1">
              <VisibilityIcon size={11} aria-hidden />
              {communityName || "Public"}
            </span>
          )}
        </div>
      </div>
      {postActions}
    </div>
  );

  const commentsVisible = !compact || commentsOpen;
  const mainInputVisible = compact ? commentsOpen : showMainCommentInput;

  const mainContent = (
    <>
      <article className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden w-full">
        <div className="p-4 sm:p-5 space-y-4">
          {authorBlock}

          <h1 className="text-xl font-semibold tracking-tight text-fo-text leading-snug">
            {post.title || "Untitled"}
          </h1>

          {post.media && post.media.length > 0 ? (
            <div className="relative w-full rounded-lg overflow-hidden border border-fo-border">
              <PostMediaGallery
                media={post.media}
                counterOverlay
                heightClass="aspect-video"
              />
            </div>
          ) : null}

          {post.text ? (
            <p className="text-sm sm:text-[15px] text-fo-muted whitespace-pre-wrap leading-relaxed">
              {post.text}
            </p>
          ) : null}

          {needsCommunityJoin ? (
            <div className="rounded-xl border border-fo-accent/30 bg-fo-accent/10 px-4 py-3 space-y-2">
              <p className="text-xs text-fo-text">
                Join{" "}
                <span className="text-fo-accent font-medium">
                  {post.community?.name || "this community"}
                </span>{" "}
                to like and comment.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoinCommunity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
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
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-text"
                  >
                    View community
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-4 border-t border-fo-border/60 pt-3">
            <PostActions
              post={post}
              onLike={handleLikePost}
              onReshare={handleResharePost}
              onComment={() => {
                setReplyTargetId(null);
                setCommentText("");
                if (compact) {
                  setCommentsOpen((prev) => !prev);
                } else {
                  setShowMainCommentInput((prev) => !prev);
                }
              }}
            />

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
                className="inline-flex items-center gap-2 text-xs font-medium text-fo-muted hover:text-red-400 transition-colors ml-auto"
                title="Report post"
              >
                <Flag size={15} />
                <span>Report</span>
              </button>
            ) : null}
          </div>
        </div>
      </article>

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

      {mobileRail}
    </>
  );

  return (
    <div className={shellClass}>
      {backButton ? <div className="mb-3">{backButton}</div> : null}
      <div
        className={
          includeRail
            ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start"
            : ""
        }
      >
        <div className={includeRail || compact || embedded ? "min-w-0 space-y-3" : "space-y-6"}>
          {mainContent}
        </div>
        {desktopRail}
      </div>

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