import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { fetchPublicPosts } from "../../../../api/posts";
import PostCard from "../../components/PostCard";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../../shared/services/entityLinks";

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
];

export default function AllPosts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const searchInputRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async ({ q = "", sort = "newest", pageNum = 1, append = false } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = {
          page: pageNum,
          limit: PAGE_SIZE,
          sortBy: sort,
        };
        if (q.trim()) params.q = q.trim();
        const data = await fetchPublicPosts(params);
        const next = data?.posts || [];
        setPosts((prev) => (append ? [...prev, ...next] : next));
        setHasMore(Boolean(data?.pagination?.hasMore));
        setPage(pageNum);
      } catch (err) {
        showToast(
          err?.response?.data?.message || "Unable to load posts right now."
        );
        if (!append) setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load({ q: query, sort: sortBy, pageNum: 1, append: false });
  }, [load, query, sortBy]);

  useEffect(() => {
    if (!location.state?.focusSearch) return;
    searchInputRef.current?.focus();
    navigate(".", { replace: true, state: {} });
  }, [location.state, navigate]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    load({ q: query, sort: sortBy, pageNum: page + 1, append: true });
  };

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="relative overflow-hidden border-b border-[#2A241E]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1612] via-[#0E0C0A] to-[#0E0C0A]" />
        <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-[#D4AF37]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#D4AF37] leading-tight">
            All Posts
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#A69B8D] max-w-xl">
            Search public posts shared without a community. Sort by newest,
            likes, or comments.
          </p>
          <form
            onSubmit={handleSearch}
            className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl w-full"
          >
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search posts by title or text..."
                className="w-full pl-9 pr-3 py-3 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-sm placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort posts"
                className="px-3 py-3 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-sm focus:outline-none focus:border-[#D4AF37]/50"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 sm:px-6 py-3 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-2xl py-16 text-center text-[#8C8070] text-sm px-4 max-w-xl mx-auto">
            {query ? `No posts match “${query}”.` : "No public posts to show yet."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => navigate(`/posts/${postSegment(post)}`)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#2A241E] text-sm text-[#E5E0D8] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-60 transition-colors"
                >
                  {loadingMore && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </>
        )}

        {!isAuthenticated && (
          <p className="mt-10 text-center text-xs text-[#8C8070]">
            <Link to="/login" className="text-[#D4AF37] hover:underline">
              Sign in
            </Link>{" "}
            to like or comment on posts.
          </p>
        )}
      </div>
    </div>
  );
}
