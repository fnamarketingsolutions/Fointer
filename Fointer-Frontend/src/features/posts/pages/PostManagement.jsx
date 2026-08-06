import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  X,
  Loader2,
  Heart,
  MessageCircle,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import {
  fetchPosts,
  createPost,
} from "../../../api/posts";
import { fetchJoinedCommunities } from "../../../api/communities";
import MediaPicker from "../../../shared/components/media/MediaPicker";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../shared/services/entityLinks";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#E5E0D8]">
              Post Management
            </h1>
            <p className="text-xs text-[#A69B8D] mt-1">
              Create and manage your posts. Community is optional.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C8070]" />
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#14100D] border border-[#2A241E] rounded-lg pl-9 pr-4 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 placeholder-[#8C8070]"
            />
          </form>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort posts"
            className="bg-[#14100D] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 shrink-0"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold hover:bg-[#c4a030] transition-colors shrink-0"
          >
            <Plus size={16} />
            Create Post
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[#A69B8D] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-16 text-center text-[#8C8070] text-sm">
          No posts yet. Create your first post.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {posts.map((post) => {
              const cover =
                post.media?.find((m) => m.type === "image") ||
                post.media?.[0] ||
                null;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() =>
                    navigate(`/dashboard/posts/${postSegment(post)}`)
                  }
                  className="text-left bg-[#14100D] border border-[#2A241E] rounded-xl overflow-hidden hover:border-[#D4AF37]/40 transition-all flex flex-col"
                >
                  <div className="h-40 bg-[#0E0C0A] overflow-hidden">
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
                      <div className="w-full h-full bg-gradient-to-br from-[#251E17] to-[#0E0C0A] flex items-center justify-center text-[#5A5046]">
                        <ImageIcon size={28} />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    {post.community?.name && (
                      <p className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-mono truncate">
                        {post.community.name}
                      </p>
                    )}
                    <h3 className="font-serif font-bold text-base text-[#E5E0D8] line-clamp-2">
                      {post.title || "Untitled"}
                    </h3>
                    <p className="text-xs text-[#A69B8D] line-clamp-3 flex-1">
                      {post.text || "No description"}
                    </p>
                    <div className="flex items-center gap-3 pt-2 border-t border-[#2A241E]/40 text-[11px] text-[#8C8070]">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={11} /> {post.likeCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={11} /> {post.commentCount || 0}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#2A241E] text-xs text-[#E5E0D8] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-60 transition-colors"
              >
                {loadingMore && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeForm}
          />
          <form
            onSubmit={handleSubmit}
            className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#14100D] border border-[#2A241E] rounded-t-xl sm:rounded-xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#E5E0D8]">Create Post</h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8]"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
                Community (optional)
              </label>
              <select
                value={form.communityId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, communityId: e.target.value }))
                }
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              >
                <option value="">No community</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                required
                placeholder="Post title"
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
                Description
              </label>
              <textarea
                value={form.text}
                onChange={(e) =>
                  setForm((p) => ({ ...p, text: e.target.value }))
                }
                rows={4}
                placeholder="What do you want to share?"
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
              />
            </div>

            <MediaPicker
              media={form.media}
              onChange={(media) => setForm((p) => ({ ...p, media }))}
              onError={showToast}
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
