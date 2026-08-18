import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBan as Ban,
  LuFileText as FileText,
  LuHeart as Heart,
  LuImage as ImageIcon,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRefreshCw as RefreshCw,
  LuReply as Reply,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuX as X
} from "react-icons/lu";
import {
  deleteAdminModerationComment,
  deleteAdminModerationPost,
  fetchAdminModerationComments,
  fetchAdminModerationPosts,
  updateUserStatus,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "comments", label: "Comments" },
];

const SCOPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "community", label: "Community" },
  { id: "public", label: "Public" },
];

const PAGE_SIZE = 20;

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-[#2A241E] text-[#A69B8D] hover:text-[#E5E0D8] hover:border-[#D4AF37]/30",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
    primary:
      "border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function ContentModeration() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("posts");
  const [scope, setScope] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [postSummary, setPostSummary] = useState({
    all: 0,
    community: 0,
    public: 0,
  });
  const [commentTotal, setCommentTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [banBusyId, setBanBusyId] = useState(null);
  const [preview, setPreview] = useState(null);

  const loadPosts = useCallback(
    async ({ pageNum = 1, append = false, q = "", scopeFilter = "all" } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const data = await fetchAdminModerationPosts({
          page: pageNum,
          limit: PAGE_SIZE,
          scope: scopeFilter,
          ...(q.trim() ? { q: q.trim() } : {}),
        });
        const next = data?.posts || [];
        setPosts((prev) => (append ? [...prev, ...next] : next));
        setPostSummary(data?.summary || { all: 0, community: 0, public: 0 });
        setHasMore(Boolean(data?.pagination?.hasMore));
        setPage(pageNum);
      } catch (err) {
        showToast(getErrorMessage(err, "Failed to load posts."));
        if (!append) setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  const loadComments = useCallback(
    async ({ pageNum = 1, append = false, q = "" } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const data = await fetchAdminModerationComments({
          page: pageNum,
          limit: PAGE_SIZE,
          ...(q.trim() ? { q: q.trim() } : {}),
        });
        const next = data?.comments || [];
        setComments((prev) => (append ? [...prev, ...next] : next));
        setCommentTotal(
          data?.pagination?.total ?? data?.summary?.all ?? next.length
        );
        setHasMore(Boolean(data?.pagination?.hasMore));
        setPage(pageNum);
      } catch (err) {
        showToast(getErrorMessage(err, "Failed to load comments."));
        if (!append) setComments([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    setPage(1);
    if (tab === "posts") {
      loadPosts({ pageNum: 1, q: query, scopeFilter: scope });
    } else {
      loadComments({ pageNum: 1, q: query });
    }
  }, [tab, query, scope, loadPosts, loadComments]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleRefresh = () => {
    if (tab === "posts") {
      loadPosts({ pageNum: 1, q: query, scopeFilter: scope });
    } else {
      loadComments({ pageNum: 1, q: query });
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    if (tab === "posts") {
      loadPosts({
        pageNum: page + 1,
        append: true,
        q: query,
        scopeFilter: scope,
      });
    } else {
      loadComments({ pageNum: page + 1, append: true, q: query });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "post") {
        await deleteAdminModerationPost(deleteTarget.id);
        setPosts((prev) =>
          prev.filter((p) => String(p.id) !== String(deleteTarget.id))
        );
        showToast("Post deleted.");
      } else {
        await deleteAdminModerationComment(deleteTarget.id);
        setComments((prev) =>
          prev.filter((c) => String(c.id) !== String(deleteTarget.id))
        );
        showToast("Comment deleted.");
      }
      setDeleteTarget(null);
      if (preview?.id === deleteTarget.id) setPreview(null);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete content."));
    } finally {
      setDeleting(false);
    }
  };

  const handleBanAuthor = async (author) => {
    const userId = author?.id;
    if (!userId) return;
    if (author.status === "banned" || author.authorStatus === "banned") {
      showToast("This user is already banned.");
      return;
    }
    if (
      !window.confirm(
        `Ban ${author.name || author.username || "this user"}? They will not be able to sign in.`
      )
    ) {
      return;
    }
    setBanBusyId(userId);
    try {
      await updateUserStatus(userId, "banned");
      showToast("User banned.");
      const markBanned = (item) => {
        if (String(item.author?.id) !== String(userId)) return item;
        return {
          ...item,
          authorStatus: "banned",
          author: { ...item.author, status: "banned" },
        };
      };
      setPosts((prev) => prev.map(markBanned));
      setComments((prev) => prev.map(markBanned));
      if (preview?.author?.id && String(preview.author.id) === String(userId)) {
        setPreview((p) =>
          p
            ? {
                ...p,
                authorStatus: "banned",
                author: { ...p.author, status: "banned" },
              }
            : p
        );
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to ban user."));
    } finally {
      setBanBusyId(null);
    }
  };

  const authorLabel = (author) =>
    author?.name || author?.username || "Unknown author";

  const isBanned = (item) =>
    item?.authorStatus === "banned" || item?.author?.status === "banned";

  const tabCount = (id) =>
    id === "posts" ? postSummary.all : commentTotal;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Moderation
          </h1>
          <p className="text-sm text-[#8C8070]">
            Review posts and comments. Delete content or ban authors.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E]">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setSearchInput("");
                setQuery("");
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {item.label}
              {!loading ? (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {tabCount(item.id)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={
              tab === "posts"
                ? "Search posts by title or text…"
                : "Search comments…"
            }
            className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] shrink-0"
        >
          Search
        </button>
      </form>

      {tab === "posts" ? (
        <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
          {SCOPE_FILTERS.map((item) => {
            const active = scope === item.id;
            const count = postSummary[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={`flex-1 min-w-[4.5rem] py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                    : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
                }`}
              >
                {item.label}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading content…
        </div>
      ) : tab === "posts" && posts.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
          <p>
            {query ? `No posts match “${query}”.` : "No posts to moderate."}
          </p>
        </div>
      ) : tab === "comments" && comments.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-2">
          <MessageCircle className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
          <p>
            {query
              ? `No comments match “${query}”.`
              : "No comments to moderate."}
          </p>
        </div>
      ) : tab === "posts" ? (
        <>
          <div className="space-y-2.5">
            {posts.map((post) => {
              const cover = post.media?.find((m) => m.type === "image");
              return (
                <article
                  key={post.id}
                  className="flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setPreview({ kind: "post", ...post })}
                    className="flex gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                        <span className="text-[#A69B8D]">
                          {post.community?.name || "Public"}
                        </span>
                        <span>·</span>
                        <span>{post.author?.username || authorLabel(post.author)}</span>
                        <span>·</span>
                        <span>{timeAgo(post.createdAt)}</span>
                        {isBanned(post) ? (
                          <>
                            <span>·</span>
                            <span className="text-red-400">Banned</span>
                          </>
                        ) : null}
                      </div>
                      <h2 className="text-sm font-semibold text-[#E5E0D8] leading-snug line-clamp-2">
                        {post.title || "Untitled"}
                      </h2>
                      {post.text ? (
                        <p className="text-xs text-[#A69B8D] line-clamp-2 leading-relaxed">
                          {post.text}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-3 text-[11px] text-[#8C8070] pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Heart size={11} /> {post.likeCount || 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={11} /> {post.commentCount || 0}
                        </span>
                      </div>
                    </div>
                    {cover ? (
                      <img
                        src={cover.url}
                        alt=""
                        className="hidden sm:block w-16 h-14 rounded-lg object-cover shrink-0 border border-[#2A241E]"
                      />
                    ) : post.mediaCount > 0 ? (
                      <div className="hidden sm:flex w-16 h-14 rounded-lg bg-[#0E0C0A] border border-[#2A241E] items-center justify-center text-[#5C5348] shrink-0">
                        <ImageIcon size={16} />
                      </div>
                    ) : null}
                  </button>

                  <div className="flex flex-col gap-1.5 shrink-0 justify-start">
                    <ActionBtn
                      tone="primary"
                      onClick={() => setPreview({ kind: "post", ...post })}
                    >
                      Review
                    </ActionBtn>
                    {post.author?.id && !isBanned(post) ? (
                      <ActionBtn
                        tone="danger"
                        disabled={banBusyId === post.author.id}
                        onClick={() => handleBanAuthor(post.author)}
                      >
                        {banBusyId === post.author.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Ban size={12} />
                        )}
                        Ban
                      </ActionBtn>
                    ) : null}
                    <ActionBtn
                      tone="danger"
                      onClick={() =>
                        setDeleteTarget({
                          kind: "post",
                          id: post.id,
                          label: post.title || "this post",
                        })
                      }
                    >
                      <Trash2 size={12} />
                      Delete
                    </ActionBtn>
                  </div>
                </article>
              );
            })}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:border-[#D4AF37]/40 hover:text-[#D4AF37] disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Load more
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="space-y-2.5">
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <button
                  type="button"
                  onClick={() => setPreview({ kind: "comment", ...comment })}
                  className="w-full text-left space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                    <span className="text-[#A69B8D]">
                      {comment.post?.community?.name ||
                        (comment.post ? "Post" : "Orphaned")}
                    </span>
                    {comment.isReply ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Reply size={10} /> Reply
                        </span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>
                      {comment.author?.username || authorLabel(comment.author)}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(comment.createdAt)}</span>
                    {isBanned(comment) ? (
                      <>
                        <span>·</span>
                        <span className="text-red-400">Banned</span>
                      </>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#E5E0D8] whitespace-pre-wrap break-words line-clamp-3 leading-relaxed">
                    {comment.text}
                  </p>
                  {comment.post?.title ? (
                    <p className="text-[11px] text-[#8C8070] truncate">
                      on {comment.post.title}
                    </p>
                  ) : null}
                </button>

                <div className="flex flex-wrap gap-1.5">
                  <ActionBtn
                    tone="primary"
                    onClick={() =>
                      setPreview({ kind: "comment", ...comment })
                    }
                  >
                    Review
                  </ActionBtn>
                  {comment.author?.id && !isBanned(comment) ? (
                    <ActionBtn
                      tone="danger"
                      disabled={banBusyId === comment.author.id}
                      onClick={() => handleBanAuthor(comment.author)}
                    >
                      {banBusyId === comment.author.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Ban size={12} />
                      )}
                      Ban
                    </ActionBtn>
                  ) : null}
                  <ActionBtn
                    tone="danger"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "comment",
                        id: comment.id,
                        label: "this comment",
                      })
                    }
                  >
                    <Trash2 size={12} />
                    Delete
                  </ActionBtn>
                </div>
              </article>
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:border-[#D4AF37]/40 hover:text-[#D4AF37] disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setPreview(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2A241E] shrink-0">
              <h2 className="text-sm font-semibold text-[#E5E0D8] capitalize">
                {preview.kind} details
              </h2>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1A1510]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] text-[#8C8070]">
                  {preview.kind === "post"
                    ? preview.community?.name || "Public post"
                    : preview.post?.community?.name || "Comment"}
                </p>
                {preview.kind === "post" ? (
                  <h3 className="text-base font-semibold text-[#E5E0D8]">
                    {preview.title || "Untitled"}
                  </h3>
                ) : null}
                <p className="text-xs text-[#8C8070]">
                  by {authorLabel(preview.author)} ·{" "}
                  {timeAgo(preview.createdAt)}
                  {preview.author?.id ? (
                    <>
                      {" · "}
                      <Link
                        to={`/admin/users/${preview.author.id}`}
                        className="text-[#D4AF37] hover:underline"
                      >
                        View user
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>

              {preview.kind === "comment" && preview.post?.title ? (
                <p className="text-xs text-[#8C8070]">
                  On post: {preview.post.title}
                </p>
              ) : null}

              <p className="text-sm text-[#E5E0D8] whitespace-pre-wrap break-words leading-relaxed">
                {preview.kind === "post"
                  ? preview.text || "No body text."
                  : preview.text}
              </p>

              {preview.kind === "post" && preview.media?.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {preview.media.map((m, i) =>
                    m.type === "video" ? (
                      <video
                        key={i}
                        src={m.url}
                        controls
                        className="w-full rounded-lg border border-[#2A241E]"
                      />
                    ) : (
                      <img
                        key={i}
                        src={m.url}
                        alt=""
                        className="w-full rounded-lg object-cover border border-[#2A241E] max-h-40"
                      />
                    )
                  )}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex flex-wrap gap-2 px-4 py-3 border-t border-[#2A241E]">
              {preview.author?.id && !isBanned(preview) ? (
                <ActionBtn
                  tone="danger"
                  disabled={banBusyId === preview.author.id}
                  onClick={() => handleBanAuthor(preview.author)}
                >
                  <Ban size={12} /> Ban author
                </ActionBtn>
              ) : null}
              <ActionBtn
                tone="danger"
                onClick={() => {
                  setDeleteTarget({
                    kind: preview.kind,
                    id: preview.id,
                    label:
                      preview.kind === "post"
                        ? preview.title || "this post"
                        : "this comment",
                  });
                }}
              >
                <Trash2 size={12} /> Delete
              </ActionBtn>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === "comment" ? "Delete comment?" : "Delete post?"
        }
        variant="post"
        loading={deleting}
        disableCloseWhileLoading
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget?.kind === "comment"
          ? "This comment and its replies will be permanently removed."
          : `“${deleteTarget?.label || "This post"}” and all of its comments and likes will be permanently removed.`}
      </ConfirmDeleteModal>
    </div>
  );
}
