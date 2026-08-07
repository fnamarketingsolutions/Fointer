import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Search, X, Heart, MessageCircle } from "lucide-react";
import { fetchPublicPost, fetchPublicPosts } from "../../../../api/posts";
import PostDetail from "../../../posts/pages/PostDetail";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

const FEED_PATH = "/dashboard/postfeed";
const PAGE_SIZE = 10;

function CustomPostCard({ post, onClick }) {
  const authorName =
    post?.author?.name || post?.author?.username || "Anonymous";
  const coverImage = post?.media?.find((m) => m.type === "image");

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

  return (
    <div
      onClick={onClick}
      className="bg-[#14100D] rounded-xl p-4 sm:p-5 flex flex-col gap-3 cursor-pointer transition-all shadow-md group w-full"
    >
      {/* 1. Author Name & Time Header */}
      <div className="flex items-center gap-3">
        {post?.author?.avatar ? (
          <img
            src={post.author.avatar}
            alt={authorName}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] text-xs font-semibold shrink-0">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-semibold text-[#E5E0D8] truncate group-hover:text-[#D4AF37] transition-colors">
            {authorName}
          </h4>
          <span className="text-[10px] sm:text-xs text-[#8C8070] block">
            {timeAgo(post?.createdAt)}
          </span>
        </div>
      </div>

      {/* 2. Image */}
      {coverImage && (
        <div className="w-full h-48 sm:h-52 rounded-lg overflow-hidden bg-[#0A0806] my-1">
          <img
            src={coverImage.url}
            alt={post?.title || "Post media"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* 3. Title */}
      {post?.title && (
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#E5E0D8] line-clamp-2 leading-snug">
          {post.title}
        </h3>
      )}

      {/* 4. Description */}
      {post?.text && (
        <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-3 leading-relaxed">
          {post.text}
        </p>
      )}

      {/* 5. Likes & Comments Icons Section */}
      <div className="flex items-center gap-4 pt-2 text-xs text-[#A69B8D] mt-auto">
        <div className="flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors">
          <Heart
            size={16}
            className={post?.likedByMe ? "fill-current text-[#D4AF37]" : ""}
          />
          <span>{post?.likeCount || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors">
          <MessageCircle size={16} />
          <span>{post?.commentCount || 0}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardFeed() {
  const navigate = useNavigate();
  const { postSlug } = useParams();
  const { showToast } = useToast();
  const { id: openPostId, resolving: postResolving } = useEntityId(
    "post",
    postSlug
  );
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async ({ q = "", pageNum = 1, append = false } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = {
          page: pageNum,
          limit: PAGE_SIZE,
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
    load({ q: query, pageNum: 1, append: false });
  }, [load, query]);

  const openPost = (post) => {
    navigate(`${FEED_PATH}/${postSegment(post)}`);
  };

  const closePost = useCallback(() => {
    navigate(FEED_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!postSlug) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePost();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [postSlug, closePost]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    load({ q: query, pageNum: page + 1, append: true });
  };

  return (
    <div className="text-[#E5E0D8] w-full px-2 sm:px-4 lg:px-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-[#D4AF37] leading-tight">
          Feed
        </h1>
        <p className="mt-2 text-sm text-[#A69B8D] max-w-xl">
          Browse all public posts shared on Fointer. Search and sort by newest,
          likes, or comments.
        </p>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl w-full"
        >
          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts by title or text..."
              className="w-full pl-9 pr-3 py-3 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-sm placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="submit"
              className="px-4 sm:px-6 py-3 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2 w-full">
          <Loader2 size={18} className="animate-spin text-[#D4AF37]" />
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-2xl py-16 text-center text-[#8C8070] text-sm px-4 max-w-xl mx-auto">
          {query
            ? `No posts match “${query}”.`
            : "No public posts to show yet."}
        </div>
      ) : (
        <>
          {/* Full Width Grid Container */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {posts.map((post) => (
              <CustomPostCard
                key={post.id}
                post={post}
                onClick={() => openPost(post)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center w-full">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#2A241E] text-sm text-[#E5E0D8] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-60 transition-colors"
              >
                {loadingMore && <Loader2 size={16} className="animate-spin text-[#D4AF37]" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {postSlug && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closePost}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Post details"
            className="relative w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto bg-[#0E0C0A] border border-[#2A241E] sm:rounded-2xl shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2A241E] bg-[#14100D]/95 backdrop-blur">
              <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">
                Post
              </span>
              <button
                type="button"
                onClick={closePost}
                aria-label="Close post"
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#2A241E]/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <PostDetail
              key={postSlug}
              postId={openPostId}
              resolving={postResolving}
              embedded
              compact
              fetchPostFn={fetchPublicPost}
              onBack={closePost}
              onDeleted={() => {
                closePost();
                load({ q: query, pageNum: 1, append: false });
              }}
              postPathBuilder={(post) => `${FEED_PATH}/${postSegment(post)}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}