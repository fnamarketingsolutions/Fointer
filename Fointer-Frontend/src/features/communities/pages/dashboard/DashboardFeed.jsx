import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Loader2,
  Search,
  X,
  Heart,
  MessageCircle,
  Radio,
  Video,
  Users,
  Globe,
  Lock,
} from "lucide-react";
import { fetchPublicPost, fetchPublicPosts } from "../../../../api/posts";
import PostDetail from "../../../posts/pages/PostDetail";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";
import { fetchLiveEvents } from "../../../liveevents/services/liveEventService";
import { fetchWatchGroups } from "../../../watchgroups/services/watchGroupService";
import { getErrorMessage } from "../../../../shared/utils/errors";

const FEED_PATH = "/dashboard/postfeed";
const LIVE_EVENTS_PATH = "/dashboard/events";
const WATCH_GROUPS_PATH = "/dashboard/watchgroups";
const PAGE_SIZE = 10;
const SIDEBAR_PREVIEW_COUNT = 3;

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

      {coverImage && (
        <div className="w-full h-48 sm:h-52 rounded-lg overflow-hidden bg-[#0A0806] my-1">
          <img
            src={coverImage.url}
            alt={post?.title || "Post media"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {post?.title && (
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#E5E0D8] line-clamp-2 leading-snug">
          {post.title}
        </h3>
      )}

      {post?.text && (
        <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-3 leading-relaxed">
          {post.text}
        </p>
      )}

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

function FeedSidebarSection({
  title,
  icon: Icon,
  viewMoreTo,
  loading,
  emptyLabel,
  children,
}) {
  return (
    <section className="space-y-1.5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-[#E5E0D8] flex items-center gap-1.5">
          <Icon size={14} className="text-[#D4AF37]" />
          {title}
        </h2>
        <Link
          to={viewMoreTo}
          className="text-[11px] font-medium text-[#D4AF37] hover:text-[#e0c04a] transition-colors whitespace-nowrap"
        >
          View more
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-[#8C8070] text-xs gap-2">
          <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
          Loading...
        </div>
      ) : React.Children.count(children) === 0 ? (
        <p className="text-xs text-[#8C8070] px-1 py-3">{emptyLabel}</p>
      ) : (
        <div className="space-y-0 overflow-hidden">{children}</div>
      )}
    </section>
  );
}

function LiveEventPreviewTile({ event, onClick }) {
  const AccessIcon =
    event.access === "community_restricted" ? Lock : Globe;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-transparent border-x-0 border-t-0 border-b border-[#D4AF37]/70 hover:border-[#D4AF37] px-1.5 py-2 space-y-1 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif font-bold text-sm text-[#E5E0D8] leading-snug min-w-0 flex-1 truncate">
          {event.title}
        </h3>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide shrink-0 ${
            event.access === "community_restricted"
              ? "bg-[#2A241E] text-[#A69B8D]"
              : "bg-[#D4AF37]/15 text-[#D4AF37]"
          }`}
        >
          <AccessIcon size={9} />
          {event.access === "community_restricted" ? "Restricted" : "Public"}
        </span>
      </div>
      <p className="text-[10px] text-[#8C8070] font-mono uppercase tracking-wider truncate">
        {event.community?.name || "Community"}
      </p>
      <div className="flex items-center gap-1.5 text-[11px] text-[#A69B8D]">
        <Users size={12} className="text-[#D4AF37]" />
        {event.participantCount ?? 0} watching
      </div>
    </button>
  );
}

function WatchGroupPreviewTile({ group, onClick }) {
  const TypeIcon = group.type === "private" ? Lock : Globe;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-transparent border-x-0 border-t-0 border-b border-[#D4AF37]/70 hover:border-[#D4AF37] px-1.5 py-2 space-y-1 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif font-bold text-sm text-[#E5E0D8] leading-snug min-w-0 flex-1 truncate">
          {group.name}
        </h3>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide shrink-0 ${
            group.type === "private"
              ? "bg-[#2A241E] text-[#A69B8D]"
              : "bg-[#D4AF37]/15 text-[#D4AF37]"
          }`}
        >
          <TypeIcon size={9} />
          {group.type}
        </span>
      </div>
      <p className="text-[10px] text-[#8C8070] font-mono uppercase tracking-wider truncate">
        {group.community?.name || "No community"}
      </p>
      <div className="flex items-center gap-1.5 text-[11px] text-[#A69B8D]">
        <Users size={12} className="text-[#D4AF37]" />
        {group.participantCount ?? 0}/{group.maxParticipants} participants
      </div>
    </button>
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

  const [liveEvents, setLiveEvents] = useState([]);
  const [watchGroups, setWatchGroups] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);

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

  const loadSidebar = useCallback(async () => {
    setSidebarLoading(true);
    try {
      const [eventsData, groupsData] = await Promise.all([
        fetchLiveEvents(),
        fetchWatchGroups(),
      ]);
      setLiveEvents((eventsData?.liveEvents || []).slice(0, SIDEBAR_PREVIEW_COUNT));
      setWatchGroups(
        (groupsData?.watchGroups || []).slice(0, SIDEBAR_PREVIEW_COUNT)
      );
    } catch (err) {
      showToast(getErrorMessage(err, "Unable to load sidebar previews."));
      setLiveEvents([]);
      setWatchGroups([]);
    } finally {
      setSidebarLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load({ q: query, pageNum: 1, append: false });
  }, [load, query]);

  useEffect(() => {
    loadSidebar();
  }, [loadSidebar]);

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

  const sidebarBlocks = (
    <>
      <FeedSidebarSection
        title="Live Events"
        icon={Radio}
        viewMoreTo={LIVE_EVENTS_PATH}
        loading={sidebarLoading}
        emptyLabel="No live events yet."
      >
        {liveEvents.map((event) => (
          <LiveEventPreviewTile
            key={event.id}
            event={event}
            onClick={() => navigate(LIVE_EVENTS_PATH)}
          />
        ))}
      </FeedSidebarSection>

      <FeedSidebarSection
        title="Watch Groups"
        icon={Video}
        viewMoreTo={WATCH_GROUPS_PATH}
        loading={sidebarLoading}
        emptyLabel="No watch groups yet."
      >
        {watchGroups.map((group) => (
          <WatchGroupPreviewTile
            key={group.id}
            group={group}
            onClick={() => navigate(WATCH_GROUPS_PATH)}
          />
        ))}
      </FeedSidebarSection>
    </>
  );

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

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left: posts ~60% */}
        <div className="w-full lg:w-[60%] min-w-0">
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
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                    {loadingMore && (
                      <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
                    )}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: sidebar ~40% — fixed in view, not independently scrollable */}
        <aside className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-4 lg:self-start space-y-5 overflow-hidden shrink-0">
          {sidebarBlocks}
        </aside>
      </div>

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
