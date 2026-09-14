import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuSearch as Search,
  LuPlus as Plus,
  LuLoaderCircle as Loader2,
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuImage as ImageIcon,
  LuRefreshCw as RefreshCw,
  LuFileText as FileText,
} from "react-icons/lu";
import { fetchPosts, createPost } from "../../../api/posts";
import { fetchJoinedCommunities } from "../../../api/communities";
import CreatePostForm from "../../../shared/components/forms/CreatePostForm";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../shared/services/entityLinks";
import { timeAgo } from "../../../shared/utils/date";

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
];

const emptyForm = {
  communityId: "",
  title: "",
  text: "",
  media: [],
};

export default function PostManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadPosts = useCallback(
    async ({
      q = "",
      sort = "newest",
      pageNum = 1,
      append = false,
    } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = {
          mine: "1",
          page: pageNum,
          limit: PAGE_SIZE,
          sortBy: sort,
        };
        if (q) params.q = q;
        const data = await fetchPosts(params);
        const next = data?.posts || [];
        setPosts((prev) => (append ? [...prev, ...next] : next));
        setHasMore(Boolean(data?.pagination?.hasMore));
        setPage(pageNum);
      } catch (err) {
        showToast(err?.response?.data?.message || "Failed to load posts.");
        if (!append) setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  const loadCommunities = useCallback(async () => {
    try {
      const data = await fetchJoinedCommunities();
      setCommunities(data?.communities || []);
    } catch {
      setCommunities([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadPosts({ q: query, sort: sortBy, pageNum: 1, append: false }),
      loadCommunities(),
    ]);
  }, [loadPosts, loadCommunities, query, sortBy]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    loadPosts({ q: query, sort: sortBy, pageNum: 1, append: false });
  }, [query, sortBy, loadPosts]);

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    loadPosts({ q: query, sort: sortBy, pageNum: page + 1, append: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        text: form.text.trim(),
        media: form.media,
      };
      if (form.communityId) {
        payload.communityId = form.communityId;
      }
      await createPost(payload);
      closeForm();
      await loadPosts({ q: query, sort: sortBy, pageNum: 1, append: false });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create post.");
    } finally {
      setSaving(false);
    }
  };

  const openPost = (post) => {
    navigate(`/post-management/${postSegment(post)}`);
  };

  if (showForm) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-5">
        <CreatePostForm
          title={form.title}
          text={form.text}
          media={form.media}
          onTitleChange={(title) => setForm((p) => ({ ...p, title }))}
          onTextChange={(text) => setForm((p) => ({ ...p, text }))}
          onMediaChange={(media) => setForm((p) => ({ ...p, media }))}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          saving={saving}
          showCommunitySelect
          communities={communities}
          communityId={form.communityId}
          onCommunityChange={(communityId) =>
            setForm((p) => ({ ...p, communityId }))
          }
          onError={showToast}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Post Management
          </h1>
          <p className="text-sm text-fo-subtle">
            Create and manage your posts. Community is optional.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover transition-colors"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {SORT_OPTIONS.map((opt) => {
          const active = sortBy === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSortBy(opt.value)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="search"
          placeholder="Search posts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
          <FileText className="w-8 h-8 mx-auto text-fo-accent/40" />
          <p>
            {query
              ? "No posts match your search."
              : "No posts yet. Create your first post."}
          </p>
          {!query ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
            >
              <Plus size={14} /> Create Post
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {posts.map((post) => {
              const cover =
                post.media?.find((m) => m.type === "image") ||
                post.media?.[0] ||
                null;

              return (
                <article
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPost(post)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPost(post);
                    }
                  }}
                  className="group flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors cursor-pointer"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-fo-bg border border-fo-border flex items-center justify-center text-[#5A5046]">
                    {cover ? (
                      cover.type === "video" ? (
                        <video
                          src={cover.url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={cover.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-fo-subtle">
                      {post.community?.name ? (
                        <span className="text-fo-accent/90 truncate max-w-[12rem]">
                          {post.community.name}
                        </span>
                      ) : (
                        <span>Personal post</span>
                      )}
                      {post.createdAt ? (
                        <>
                          <span>·</span>
                          <span>{timeAgo(post.createdAt)}</span>
                        </>
                      ) : null}
                    </div>

                    <h2 className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2 leading-snug">
                      {post.title || "Untitled"}
                    </h2>

                    {post.text ? (
                      <p className="text-[11px] text-fo-subtle line-clamp-1">
                        {post.text}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-3 pt-0.5 text-[11px] text-fo-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={11} /> {post.likeCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Repeat2 size={11} /> {post.reshareCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={11} /> {post.commentCount || 0}
                      </span>
                    </div>
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
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-fo-border text-xs text-fo-text hover:border-fo-accent/50 hover:text-fo-accent disabled:opacity-60 transition-colors"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin text-fo-accent" />
                ) : null}
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
