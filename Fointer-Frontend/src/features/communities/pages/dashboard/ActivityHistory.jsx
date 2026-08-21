import React, { useCallback, useEffect, useState } from "react";
import {
  LuClock as Clock,
  LuSquarePen as Edit3,
  LuHeart as Heart,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuReply as Reply,
  LuTrash2 as Trash2
} from "react-icons/lu";
import {
  deleteComment,
  deletePost,
  fetchMyComments,
  fetchMyLikedPosts,
  fetchMyResharedPosts,
  fetchPosts,
  togglePostLike,
  togglePostReshare,
} from "../../../../api/posts";
import PostDetail from "../../../posts/pages/PostDetail";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import EditWindowExpiredModal from "../../../../shared/components/modals/EditWindowExpiredModal";
import { timeAgo } from "../../../../shared/utils/date";
import { useToast } from "../../../../shared/components/feedback/ToastContext";

const TABS = [
  { id: "posts", label: "My Posts" },
  { id: "comments", label: "Comments" },
  { id: "likes", label: "Liked" },
  { id: "reposts", label: "Reposts" },
];

const getEditWindowLabel = (createdAt, canEdit, editWindowMinutes = 60) => {
  if (!createdAt || !canEdit) return "Edit window expired";
  const windowMs = Math.max(1, Number(editWindowMinutes) || 60) * 60 * 1000;
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const remaining = windowMs - elapsed;
  if (remaining <= 0) return "Edit window expired";
  const mins = Math.ceil(remaining / 60000);
  return `${mins} min${mins === 1 ? "" : "s"} left to edit`;
};

function EmptyState({ children }) {
  return (
    <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
      {children}
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
      <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
      {label}
    </div>
  );
}

function MetaLine({ children }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
      {children}
    </div>
  );
}

function ActionButton({ onClick, disabled, tone = "default", children }) {
  const tones = {
    default:
      "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40 hover:text-[#D4AF37]",
    danger:
      "border-[#2A241E] text-[#A69B8D] hover:border-red-500/40 hover:text-red-400",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function ActivityHistory() {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [repostedPosts, setRepostedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletePostId, setDeletePostId] = useState(null);
  const [deleteCommentId, setDeleteCommentId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [viewingPostId, setViewingPostId] = useState(null);
  const [lockModal, setLockModal] = useState(null);
  const [unlikingId, setUnlikingId] = useState(null);
  const [unrepostingId, setUnrepostingId] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPosts({ mine: "1" });
      setPosts(data?.posts || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load your posts.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyComments();
      setMyComments(data?.comments || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load comments.");
      setMyComments([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadLikes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyLikedPosts();
      setLikedPosts(data?.posts || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load liked posts.");
      setLikedPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadReshares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyResharedPosts();
      setRepostedPosts(data?.posts || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load your reposts.");
      setRepostedPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (subTab === "posts") loadPosts();
    else if (subTab === "comments") loadComments();
    else if (subTab === "likes") loadLikes();
    else loadReshares();
  }, [subTab, loadPosts, loadComments, loadLikes, loadReshares]);

  const reloadCurrent = () => {
    if (subTab === "posts") loadPosts();
    else if (subTab === "comments") loadComments();
    else if (subTab === "likes") loadLikes();
    else loadReshares();
  };

  const showLockModal = (item, kind = "post") => {
    setLockModal({
      editWindowMinutes: item?.editWindowMinutes ?? 60,
      kind,
    });
  };

  const openEdit = (post) => {
    if (!post) return;
    if (!post.canEdit) {
      if (post.isAuthor || post.isLocked) showLockModal(post);
      return;
    }
    setEditingPostId(post.id);
  };

  const openDelete = (post) => {
    if (!post) return;
    if (!post.canDelete) {
      if (post.isAuthor || post.isLocked) showLockModal(post);
      return;
    }
    setDeletePostId(post.id);
  };

  const openDeleteComment = (comment) => {
    if (!comment) return;
    if (!comment.canDelete) {
      if (comment.isAuthor || comment.isLocked) {
        showLockModal(comment, "comment");
      }
      return;
    }
    setDeleteCommentId(comment.id);
  };

  const handleDelete = async () => {
    if (!deletePostId) return;
    setDeleting(true);
    try {
      await deletePost(deletePostId);
      setDeletePostId(null);
      await loadPosts();
      showToast("Post deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete post.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!deleteCommentId) return;
    setDeleting(true);
    try {
      await deleteComment(deleteCommentId);
      setDeleteCommentId(null);
      setMyComments((prev) =>
        prev.filter((c) => String(c.id) !== String(deleteCommentId))
      );
      showToast("Comment deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete comment.");
    } finally {
      setDeleting(false);
    }
  };

  const handleUnlike = async (postId) => {
    setUnlikingId(postId);
    try {
      await togglePostLike(postId);
      setLikedPosts((prev) =>
        prev.filter((p) => String(p.id) !== String(postId))
      );
      showToast("Removed from liked posts.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to unlike post.");
    } finally {
      setUnlikingId(null);
    }
  };

  const handleUndoReshare = async (postId) => {
    setUnrepostingId(postId);
    try {
      await togglePostReshare(postId);
      setRepostedPosts((prev) =>
        prev.filter((p) => String(p.id) !== String(postId))
      );
      showToast("Removed from your reposts.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to undo repost.");
    } finally {
      setUnrepostingId(null);
    }
  };

  if (editingPostId || viewingPostId) {
    const postId = editingPostId || viewingPostId;
    return (
      <PostDetail
        postId={postId}
        onBack={() => {
          setEditingPostId(null);
          setViewingPostId(null);
          reloadCurrent();
        }}
        onDeleted={() => {
          setEditingPostId(null);
          setViewingPostId(null);
          reloadCurrent();
        }}
        backLabel="Back to activity"
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
          Activity
        </h1>
        <p className="text-sm text-[#8C8070]">
          Your posts, comments, likes, and reposts in one place.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TABS.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 min-w-[4.75rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* My Posts */}
      {subTab === "posts" && (
        <div className="space-y-2.5">
          {loading ? (
            <LoadingState label="Loading your posts…" />
          ) : posts.length === 0 ? (
            <EmptyState>You haven’t created any posts yet.</EmptyState>
          ) : (
            posts.map((post) => {
              const showEdit =
                post.canEdit || (post.isAuthor && post.isLocked);
              const showDelete =
                post.canDelete || (post.isAuthor && post.isLocked);
              const label = getEditWindowLabel(
                post.createdAt,
                post.canEdit,
                post.editWindowMinutes
              );
              const cover = post?.media?.find((m) => m.type === "image");

              return (
                <article
                  key={post.id}
                  className="group flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setViewingPostId(post.id)}
                    className="flex-1 min-w-0 text-left space-y-2"
                  >
                    <MetaLine>
                      <span className="text-[#A69B8D] group-hover:text-[#D4AF37] transition-colors">
                        {post.community?.name || "Personal post"}
                      </span>
                      <span>·</span>
                      <span>{timeAgo(post.createdAt)}</span>
                    </MetaLine>

                    <h2 className="text-sm sm:text-base font-semibold text-[#E5E0D8] leading-snug group-hover:text-[#D4AF37] transition-colors line-clamp-2">
                      {post.title || "Untitled"}
                    </h2>

                    {post.text ? (
                      <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed">
                        {post.text}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-4 pt-0.5 text-xs text-[#8C8070]">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart size={13} />
                        {post.likeCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Repeat2 size={13} />
                        {post.reshareCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle size={13} />
                        {post.commentCount || 0}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          post.canEdit ? "text-[#D4AF37]/80" : ""
                        }`}
                      >
                        <Clock size={12} />
                        {label}
                      </span>
                    </div>
                  </button>

                  {cover ? (
                    <div className="hidden sm:block w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-[#0A0806] border border-[#2A241E]">
                      <img
                        src={cover.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  {(showEdit || showDelete) && (
                    <div className="flex flex-col gap-1.5 shrink-0 justify-start">
                      {showEdit && (
                        <ActionButton onClick={() => openEdit(post)}>
                          <Edit3 size={12} />
                          <span className="hidden sm:inline">Edit</span>
                        </ActionButton>
                      )}
                      {showDelete && (
                        <ActionButton
                          tone="danger"
                          onClick={() => openDelete(post)}
                        >
                          <Trash2 size={12} />
                          <span className="hidden sm:inline">Delete</span>
                        </ActionButton>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Comments */}
      {subTab === "comments" && (
        <div className="space-y-2.5">
          {loading ? (
            <LoadingState label="Loading comments…" />
          ) : myComments.length === 0 ? (
            <EmptyState>You haven’t commented on any posts yet.</EmptyState>
          ) : (
            myComments.map((comment) => {
              const showDelete =
                comment.canDelete ||
                (comment.isAuthor && comment.isLocked);
              const label = getEditWindowLabel(
                comment.createdAt,
                comment.canEdit,
                comment.editWindowMinutes
              );

              return (
                <article
                  key={comment.id}
                  className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
                >
                  <MetaLine>
                    <span className="text-[#A69B8D]">
                      {comment.post?.community?.name ||
                        (comment.post ? "Post" : "Deleted post")}
                    </span>
                    {comment.isReply ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Reply size={11} /> Reply
                        </span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{timeAgo(comment.createdAt)}</span>
                  </MetaLine>

                  {comment.post?.id ? (
                    <button
                      type="button"
                      onClick={() => setViewingPostId(comment.post.id)}
                      className="text-left text-xs text-[#8C8070] hover:text-[#D4AF37] transition-colors truncate block max-w-full"
                    >
                      on {comment.post.title || "Untitled post"}
                    </button>
                  ) : null}

                  <p className="text-sm text-[#E5E0D8] whitespace-pre-wrap break-words leading-relaxed">
                    {comment.text}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 text-xs text-[#8C8070]">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart size={13} />
                        {comment.likeCount || 0}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          comment.canEdit ? "text-[#D4AF37]/80" : ""
                        }`}
                      >
                        <Clock size={12} />
                        {label}
                      </span>
                    </div>
                    {showDelete ? (
                      <ActionButton
                        tone="danger"
                        onClick={() => openDeleteComment(comment)}
                      >
                        <Trash2 size={12} />
                        Delete
                      </ActionButton>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Liked */}
      {subTab === "likes" && (
        <div className="space-y-2.5">
          {loading ? (
            <LoadingState label="Loading liked posts…" />
          ) : likedPosts.length === 0 ? (
            <EmptyState>You haven’t liked any posts yet.</EmptyState>
          ) : (
            likedPosts.map((post) => {
              const cover = post?.media?.find((m) => m.type === "image");
              const author =
                post.author?.name || post.author?.username || "Unknown";

              return (
                <article
                  key={post.id}
                  className="group flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setViewingPostId(post.id)}
                    className="flex-1 min-w-0 text-left space-y-2"
                  >
                    <MetaLine>
                      <span className="text-[#A69B8D] group-hover:text-[#D4AF37] transition-colors">
                        {post.community?.name || "Personal post"}
                      </span>
                      <span>·</span>
                      <span>{author}</span>
                      {post.likedAt ? (
                        <>
                          <span>·</span>
                          <span>Liked {timeAgo(post.likedAt)}</span>
                        </>
                      ) : null}
                    </MetaLine>

                    <h2 className="text-sm sm:text-base font-semibold text-[#E5E0D8] leading-snug group-hover:text-[#D4AF37] transition-colors line-clamp-2">
                      {post.title || "Untitled"}
                    </h2>

                    {post.text ? (
                      <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed">
                        {post.text}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-4 pt-0.5 text-xs text-[#8C8070]">
                      <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
                        <Heart size={13} className="fill-current" />
                        {post.likeCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Repeat2 size={13} />
                        {post.reshareCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle size={13} />
                        {post.commentCount || 0}
                      </span>
                    </div>
                  </button>

                  {cover ? (
                    <div className="hidden sm:block w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-[#0A0806] border border-[#2A241E]">
                      <img
                        src={cover.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="shrink-0">
                    <ActionButton
                      tone="danger"
                      disabled={unlikingId === post.id}
                      onClick={() => handleUnlike(post.id)}
                    >
                      {unlikingId === post.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Heart size={12} className="fill-current text-[#D4AF37]" />
                      )}
                      <span className="hidden sm:inline">Unlike</span>
                    </ActionButton>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Reposts */}
      {subTab === "reposts" && (
        <div className="space-y-2.5">
          {loading ? (
            <LoadingState label="Loading your reposts…" />
          ) : repostedPosts.length === 0 ? (
            <EmptyState>You haven’t reposted anything yet.</EmptyState>
          ) : (
            repostedPosts.map((post) => {
              const cover = post?.media?.find((m) => m.type === "image");
              const author =
                post.author?.name || post.author?.username || "Unknown";

              return (
                <article
                  key={post.id}
                  className="group flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setViewingPostId(post.id)}
                    className="flex-1 min-w-0 text-left space-y-2"
                  >
                    <MetaLine>
                      <span className="text-[#A69B8D] group-hover:text-[#D4AF37] transition-colors">
                        {post.community?.name || "Personal post"}
                      </span>
                      <span>·</span>
                      <span>{author}</span>
                      {post.resharedAt ? (
                        <>
                          <span>·</span>
                          <span>Reposted {timeAgo(post.resharedAt)}</span>
                        </>
                      ) : null}
                    </MetaLine>

                    <h2 className="text-sm sm:text-base font-semibold text-[#E5E0D8] leading-snug group-hover:text-[#D4AF37] transition-colors line-clamp-2">
                      {post.title || "Untitled"}
                    </h2>

                    {post.text ? (
                      <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed">
                        {post.text}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-4 pt-0.5 text-xs text-[#8C8070]">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart size={13} />
                        {post.likeCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
                        <Repeat2 size={13} />
                        {post.reshareCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle size={13} />
                        {post.commentCount || 0}
                      </span>
                    </div>
                  </button>

                  {cover ? (
                    <div className="hidden sm:block w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-[#0A0806] border border-[#2A241E]">
                      <img
                        src={cover.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="shrink-0">
                    <ActionButton
                      tone="danger"
                      disabled={unrepostingId === post.id}
                      onClick={() => handleUndoReshare(post.id)}
                    >
                      {unrepostingId === post.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Repeat2 size={12} className="text-[#D4AF37]" />
                      )}
                      <span className="hidden sm:inline">Undo</span>
                    </ActionButton>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(deletePostId)}
        title="Delete post?"
        variant="post"
        loading={deleting}
        disableCloseWhileLoading
        onConfirm={handleDelete}
        onClose={() => setDeletePostId(null)}
      >
        This cannot be undone. Comments and likes will also be removed.
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={Boolean(deleteCommentId)}
        title="Delete comment?"
        variant="comment"
        loading={deleting}
        disableCloseWhileLoading
        onConfirm={handleDeleteComment}
        onClose={() => setDeleteCommentId(null)}
      >
        This cannot be undone.
      </ConfirmDeleteModal>

      <EditWindowExpiredModal
        open={Boolean(lockModal)}
        onClose={() => setLockModal(null)}
        title="Time's up"
        message={
          lockModal?.kind === "comment"
            ? "You can no longer edit or delete this comment."
            : "You can no longer edit or delete this post."
        }
        editWindowMinutes={lockModal?.editWindowMinutes}
      />
    </div>
  );
}
