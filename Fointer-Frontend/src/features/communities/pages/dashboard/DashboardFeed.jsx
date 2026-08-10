import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Hash,
  Heart,
  Loader2,
  LogIn,
  MessageCircle,
  Search,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  fetchPost,
  fetchPosts,
  fetchPublicPost,
  fetchPublicPosts,
} from "../../../../api/posts";
import { fetchChannels } from "../../../../api/channels";
import PostDetail from "../../../posts/pages/PostDetail";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";
import { timeAgo } from "../../../../shared/utils/date";
import SiteLinksFooter from "../../../../shared/components/SiteLinksFooter";

const FEED_PATH = "/";
const FEED_POST_PATH = "/post";
const PAGE_SIZE = 15;

const FEED_MODES = [
  { id: "discover", label: "Discover" },
  { id: "personalized", label: "Personalized" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "New" },
  { id: "likes", label: "Top" },
  { id: "comments", label: "Discussed" },
];

function FeedPostRow({ post, onClick, active, showCommunity }) {
  const authorName =
    post?.author?.name || post?.author?.username || "Anonymous";
  const coverImage = post?.media?.find((m) => m.type === "image");
  const communityName = post?.community?.name;

  return (
    <article
      onClick={onClick}
      className={`group flex gap-3 bg-[#14100D] border rounded-xl overflow-hidden cursor-pointer transition-colors p-3 sm:p-4 ${
        active
          ? "border-[#D4AF37]/50"
          : "border-[#2A241E] hover:border-[#D4AF37]/35"
      }`}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
          <span className="font-semibold text-[#A69B8D] group-hover:text-[#D4AF37] transition-colors">
            {authorName}
          </span>
          <span>·</span>
          <span>{timeAgo(post?.createdAt)}</span>
          {showCommunity && communityName ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-[#D4AF37]/80">
                <Users size={10} />
                {communityName}
              </span>
            </>
          ) : null}
        </div>

        <h2 className="text-sm sm:text-base font-semibold text-[#E5E0D8] leading-snug group-hover:text-[#D4AF37] transition-colors line-clamp-2">
          {post?.title || "Untitled"}
        </h2>

        {post?.text ? (
          <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed">
            {post.text}
          </p>
        ) : null}

        <div className="flex items-center gap-4 pt-1 text-xs text-[#8C8070]">
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle size={14} />
            {post?.commentCount || 0} comments
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Heart
              size={14}
              className={post?.likedByMe ? "fill-current text-[#D4AF37]" : ""}
            />
            {post?.likeCount || 0}
          </span>
        </div>
      </div>

      {coverImage ? (
        <div className="hidden sm:block w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-[#0A0806] border border-[#2A241E]">
          <img
            src={coverImage.url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
    </article>
  );
}

function FeedSidebar({
  channels,
  channelsLoading,
  currentPostId,
  onOpenPost,
  sortBy,
  mode,
  isGuest,
  selectedChannel,
  onSelectChannel,
  isAuthenticated,
}) {
  const [otherPosts, setOtherPosts] = useState([]);
  const [otherLoading, setOtherLoading] = useState(false);
  const isPersonalized = mode === "personalized";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOtherLoading(true);
      try {
        const params = {
          page: 1,
          limit: 10,
          sortBy: sortBy === "likes" ? "likes" : "newest",
        };
        if (selectedChannel) params.channel = selectedChannel;
        const data =
          isPersonalized && isAuthenticated
            ? await fetchPosts(params)
            : await fetchPublicPosts(params);
        if (cancelled) return;
        const list = (data?.posts || []).filter(
          (p) => String(p.id) !== String(currentPostId)
        );
        setOtherPosts(list.slice(0, 8));
      } catch {
        if (!cancelled) setOtherPosts([]);
      } finally {
        if (!cancelled) setOtherLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedChannel,
    sortBy,
    mode,
    isPersonalized,
    isAuthenticated,
    currentPostId,
  ]);

  return (
    <aside className="space-y-4">
      {isGuest ? (
        <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
            Join the conversation on Fointer
          </h3>
          <p className="text-xs text-[#8C8070] leading-relaxed">
            Log in to like, comment, join communities, and create live events or
            watch groups.
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]"
          >
            <UserPlus size={14} /> Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: FEED_PATH }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#2A241E] text-[#E5E0D8] text-xs font-semibold hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
          >
            <LogIn size={14} /> Log in
          </Link>
        </div>
      ) : null}

      <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E5E0D8]">
            <Hash size={15} className="text-[#D4AF37]" />
            Categories
          </div>
          {selectedChannel ? (
            <button
              type="button"
              onClick={() => onSelectChannel("")}
              className="text-[10px] text-[#8C8070] hover:text-[#D4AF37]"
            >
              Clear
            </button>
          ) : null}
        </div>
        {channelsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#8C8070] py-2">
            <Loader2 size={12} className="animate-spin text-[#D4AF37]" />
            Loading...
          </div>
        ) : channels.length === 0 ? (
          <p className="text-xs text-[#8C8070]">No categories yet.</p>
        ) : (
          <ul className="space-y-1">
            {channels.slice(0, 12).map((ch) => {
              const name = ch.name || "";
              const active =
                selectedChannel.toLowerCase() === name.toLowerCase();
              return (
                <li key={ch.id || name}>
                  <button
                    type="button"
                    onClick={() => onSelectChannel(active ? "" : name)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                      active
                        ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                        : "text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#1C1612]"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[10px] text-[#D4AF37] font-bold shrink-0">
                      {(name || "?")[0].toUpperCase()}
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#E5E0D8] min-w-0">
          <TrendingUp size={15} className="text-[#D4AF37] shrink-0" />
          <span className="truncate">
            {selectedChannel
              ? sortBy === "likes"
                ? `Top in ${selectedChannel}`
                : `More in ${selectedChannel}`
              : sortBy === "likes"
                ? "Top posts"
                : "Other posts"}
          </span>
        </div>
        {otherLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#8C8070] py-2">
            <Loader2 size={12} className="animate-spin text-[#D4AF37]" />
            Loading...
          </div>
        ) : otherPosts.length === 0 ? (
          <p className="text-xs text-[#8C8070]">
            {selectedChannel
              ? `No other posts in ${selectedChannel}.`
              : "No other posts to show."}
          </p>
        ) : (
          <ul className="space-y-2">
            {otherPosts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenPost(p)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#1C1612] transition-colors group"
                >
                  <p className="text-xs font-medium text-[#E5E0D8] line-clamp-2 group-hover:text-[#D4AF37]">
                    {p.title || "Untitled"}
                  </p>
                  <p className="text-[10px] text-[#8C8070] mt-0.5 flex items-center gap-2">
                    <span>
                      {p.author?.name || p.author?.username || "Member"}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle size={10} /> {p.commentCount || 0}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 text-[11px] text-[#8C8070] leading-relaxed">
        <p className="font-semibold text-[#A69B8D] mb-1">About this feed</p>
        {isGuest
          ? "Public posts from communities and across Fointer. Log in to like, comment, and join communities."
          : isPersonalized
            ? "Posts from communities you have joined. Switch to Discover for all public posts."
            : "All public posts — inside communities and outside. Join a community to like or comment there."}
      </div>

      <SiteLinksFooter className="pt-1" />
    </aside>
  );
}

export default function DashboardFeed() {
  const navigate = useNavigate();
  const { postSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { id: openPostId } = useEntityId("post", postSlug);
  const isGuest = !isAuthenticated;

  const requestedMode =
    searchParams.get("mode") === "personalized" ? "personalized" : "discover";
  const mode = isGuest ? "discover" : requestedMode;
  const isPersonalized = mode === "personalized";
  const selectedChannel = String(searchParams.get("channel") || "").trim();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  const viewingPost = Boolean(postSlug);

  const feedQueryString = useMemo(() => {
    const next = new URLSearchParams();
    if (isPersonalized) next.set("mode", "personalized");
    if (selectedChannel) next.set("channel", selectedChannel);
    const s = next.toString();
    return s ? `?${s}` : "";
  }, [isPersonalized, selectedChannel]);

  const feedBase = feedQueryString ? `/${feedQueryString}` : FEED_PATH;

  const setMode = (nextMode) => {
    if (isGuest && nextMode === "personalized") {
      navigate("/login", {
        state: {
          from: selectedChannel
            ? `${FEED_PATH}?mode=personalized&channel=${encodeURIComponent(selectedChannel)}`
            : `${FEED_PATH}?mode=personalized`,
        },
      });
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (nextMode === "personalized") next.set("mode", "personalized");
    else next.delete("mode");
    setSearchParams(next, { replace: true });
    setQuery("");
    setSearchInput("");
    setSortBy("newest");
    setPosts([]);
  };

  const setChannel = (channelName) => {
    const next = new URLSearchParams(searchParams);
    const value = String(channelName || "").trim();
    if (value) next.set("channel", value);
    else next.delete("channel");
    if (viewingPost) {
      const qs = next.toString();
      navigate(qs ? `${FEED_PATH}?${qs}` : FEED_PATH);
    } else {
      setSearchParams(next, { replace: true });
    }
    setPosts([]);
  };

  const load = useCallback(
    async ({
      q = "",
      pageNum = 1,
      append = false,
      sort = "newest",
      feedMode = mode,
      channel = selectedChannel,
    } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = {
          page: pageNum,
          limit: PAGE_SIZE,
          sortBy: sort,
        };
        if (q.trim()) params.q = q.trim();
        if (channel) params.channel = channel;
        const data =
          feedMode === "personalized"
            ? await fetchPosts(params)
            : await fetchPublicPosts(params);
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
    [showToast, mode, selectedChannel]
  );

  useEffect(() => {
    load({
      q: query,
      pageNum: 1,
      append: false,
      sort: sortBy,
      feedMode: mode,
      channel: selectedChannel,
    });
  }, [load, query, sortBy, mode, selectedChannel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChannelsLoading(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) {
          setChannels(data?.channels || data?.data || []);
        }
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPost = (post) => {
    navigate(`${FEED_POST_PATH}/${postSegment(post)}${feedQueryString}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closePost = useCallback(() => {
    navigate(feedBase);
  }, [navigate, feedBase]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    load({
      q: query,
      pageNum: page + 1,
      append: true,
      sort: sortBy,
      feedMode: mode,
      channel: selectedChannel,
    });
  };

  const sidebar = (
    <FeedSidebar
      channels={channels}
      channelsLoading={channelsLoading}
      currentPostId={openPostId}
      onOpenPost={openPost}
      sortBy={sortBy}
      mode={mode}
      isGuest={isGuest}
      isAuthenticated={isAuthenticated}
      selectedChannel={selectedChannel}
      onSelectChannel={setChannel}
    />
  );

  if (viewingPost) {
    return (
      <div className="text-[#E5E0D8] w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
        <button
          type="button"
          onClick={closePost}
          className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] mb-4"
        >
          <ArrowLeft size={14} /> Back to Feed
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="min-w-0 bg-[#14100D] border border-[#2A241E] rounded-xl overflow-hidden">
            <PostDetail
              key={`${postSlug}-${mode}`}
              postId={openPostId}
              embedded
              compact={false}
              fetchPostFn={isPersonalized ? fetchPost : fetchPublicPost}
              onBack={closePost}
              onDeleted={() => {
                closePost();
                load({
                  q: query,
                  pageNum: 1,
                  append: false,
                  sort: sortBy,
                  feedMode: mode,
                  channel: selectedChannel,
                });
              }}
              postPathBuilder={(post) =>
                `${FEED_POST_PATH}/${postSegment(post)}${feedQueryString}`
              }
            />
          </div>

          <div className="lg:sticky lg:top-4 space-y-4 order-first lg:order-none">
            {sidebar}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-[#E5E0D8] w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
      <div className="mb-5 sm:mb-6 space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#E5E0D8] leading-tight">
            Feed
          </h1>
          <p className="mt-1.5 text-sm text-[#8C8070] max-w-xl">
            {selectedChannel
              ? `Showing posts in ${selectedChannel}.`
              : isPersonalized
                ? "Posts from communities you have joined."
                : "Public posts from across Fointer."}
          </p>
          {selectedChannel ? (
            <button
              type="button"
              onClick={() => setChannel("")}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25"
            >
              <Hash size={11} />
              {selectedChannel}
              <span className="opacity-70">×</span>
            </button>
          ) : null}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] max-w-md">
          {FEED_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                    : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="min-w-0 space-y-4">
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
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
                placeholder={
                  isPersonalized
                    ? "Search posts in your communities…"
                    : "Search posts…"
                }
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-sm placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] shrink-0"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#2A241E] pb-3">
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                      : "text-[#8C8070] hover:text-[#E5E0D8] hover:bg-[#1C1612]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
              <Loader2 size={18} className="animate-spin text-[#D4AF37]" />
              {isPersonalized
                ? "Loading your personalized feed…"
                : "Loading feed…"}
            </div>
          ) : posts.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-[#8C8070] text-sm px-4 space-y-3">
              {query ? (
                <p>No posts match “{query}”.</p>
              ) : selectedChannel ? (
                <>
                  <p>No posts found in {selectedChannel}.</p>
                  <button
                    type="button"
                    onClick={() => setChannel("")}
                    className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
                  >
                    Clear category filter
                  </button>
                </>
              ) : isPersonalized ? (
                <>
                  <p>
                    No posts yet from communities you have joined.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/dashboard/communities"
                      className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
                    >
                      Joined communities <ArrowRight size={14} />
                    </Link>
                    <Link
                      to="/dashboard/manage"
                      className="inline-flex items-center gap-2 text-[#A69B8D] hover:text-[#D4AF37] font-medium"
                    >
                      Manage communities <ArrowRight size={14} />
                    </Link>
                  </div>
                </>
              ) : (
                <p>No public posts to show yet.</p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <FeedPostRow
                    key={post.id}
                    post={post}
                    onClick={() => openPost(post)}
                    showCommunity
                  />
                ))}
              </div>

              {hasMore ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#2A241E] text-sm text-[#E5E0D8] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-60 transition-colors"
                  >
                    {loadingMore ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-[#D4AF37]"
                      />
                    ) : null}
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-4">{sidebar}</div>
      </div>

      <div className="lg:hidden mt-8">{sidebar}</div>
    </div>
  );
}
