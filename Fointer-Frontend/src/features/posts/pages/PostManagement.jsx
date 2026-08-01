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

const emptyForm = {
  communityId: "",
  title: "",
  text: "",
  media: [],
};

export default function PostManagement() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadPosts = useCallback(async (q = query) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPosts(
        q ? { q, mine: "1" } : { mine: "1" }
      );
      setPosts(data?.posts || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadCommunities = useCallback(async () => {
    try {
      const data = await fetchJoinedCommunities();
      setCommunities(data?.communities || []);
    } catch {
      setCommunities([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPosts(), loadCommunities()]);
  }, [loadPosts, loadCommunities]);

  useEffect(() => {
    loadPosts();
    loadCommunities();
  }, [loadPosts, loadCommunities]);

  useEffect(() => {
    loadPosts(query);
  }, [query, loadPosts]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      communityId: communities[0]?.id || "",
    });
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createPost({
        communityId: form.communityId,
        title: form.title.trim(),
        text: form.text.trim(),
        media: form.media,
      });
      closeForm();
      await loadPosts();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create post.");
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
              Create and manage your posts in communities you have joined.
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

      {error && !showForm && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[#A69B8D] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-16 text-center text-[#8C8070] text-sm">
          No posts yet. Create one for a community you joined.
        </div>
      ) : (
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
                onClick={() => navigate(`/dashboard/posts/${post.id}`)}
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
                  <p className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-mono truncate">
                    {post.community?.name || "Community"}
                  </p>
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

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
                Community
              </label>
              <select
                value={form.communityId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, communityId: e.target.value }))
                }
                required
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              >
                <option value="">Select community</option>
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
              onError={setError}
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
