import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuArrowRight as ArrowRight,
  LuCompass as Compass,
  LuHash as Hash,
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuSparkles as Sparkles,
} from "react-icons/lu";
import {
  createPost,
  fetchPost,
  fetchPosts,
  fetchPublicPost,
  fetchPublicPosts,
  fetchTrendingTopics,
  togglePostLike,
  togglePostReshare,
} from "../../../../api/posts";
import { fetchActiveBanners } from "../../../../api/banners";
import {
  fetchBrowsableCommunities,
  fetchJoinedCommunities,
} from "../../../../api/communities";
import CreatePostForm from "../../../../shared/components/forms/CreatePostForm";
import { fetchChannels } from "../../../../api/channels";
import PostDetail from "../../../posts/pages/PostDetail";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import FeedPostRow from "../../../../shared/components/FeedPostRow";
import {
  postSegment,
} from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";
import { EXPLORE_PATH, FEED_PATH } from "../../../../shared/constants/paths";
import {
  FeedDesktopRail,
  FeedFilterToggle,
  FeedFooterRail,
  FeedMobileFilters,
} from "./FeedRail";
import FeedHeroBanner from "./FeedHeroBanner";

const FEED_POST_PATH = "/post";
const PAGE_SIZE = 15;
const FILTERS_PANEL_ID = "feed-filters-panel";
const EMPTY_POST_FORM = {
  communityId: "",
  title: "",
  text: "",
  media: [],
};

const FEED_MODES = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "personalized", label: "Personalized", icon: Sparkles },
];

const SORT_OPTIONS = [
  { id: "newest", label: "New" },
  { id: "likes", label: "Top" },
  { id: "comments", label: "Discussed" },
];

const modeBtnClass = (active) =>
  `inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
    active
      ? "bg-fo-accent text-black"
      : "text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
  }`;

const sortBtnClass = (active) =>
  `relative px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg ${
    active
      ? "text-fo-accent"
      : "text-fo-subtle hover:text-fo-text"
  }`;

function FeedPostSkeleton() {
  return (
    <div
      className="bg-fo-surface border border-fo-border rounded-[16px] overflow-hidden animate-pulse shadow-[0_1px_2px_rgba(26,22,18,0.04)]"
      aria-hidden
    >
      <div className="p-3 sm:p-4 space-y-3">
        <div className="h-3 w-40 rounded bg-fo-surface-hover" />
        <div className="h-4 w-4/5 max-w-md rounded bg-fo-surface-hover" />
        <div className="h-3 w-full rounded bg-fo-surface-hover" />
        <div className="h-3 w-2/3 rounded bg-fo-surface-hover" />
      </div>
      <div className="aspect-video bg-fo-surface-2 border-t border-fo-border" />
      <div className="px-3 sm:px-4 py-3 border-t border-fo-border flex gap-5">
        <div className="h-3 w-10 rounded bg-fo-surface-hover" />
        <div className="h-3 w-10 rounded bg-fo-surface-hover" />
        <div className="h-3 w-10 rounded bg-fo-surface-hover" />
      </div>
    </div>
  );
}

export default function DashboardFeed() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { id: openPostId, resolving: resolvingPost, notFound: postNotFound } =
    useEntityId("post", postSlug);
  const isGuest = !isAuthenticated;

  const activeFeedPath =
    location.pathname === EXPLORE_PATH || location.pathname === FEED_PATH
      ? location.pathname
      : isGuest
        ? EXPLORE_PATH
        : FEED_PATH;

  const viewingMine = !isGuest && searchParams.get("mine") === "1";
  const composing = !isGuest && searchParams.get("compose") === "1";
  const requestedMode =
    searchParams.get("mode") === "personalized" ? "personalized" : "discover";
  const mode = isGuest || viewingMine ? "discover" : requestedMode;
  const isPersonalized = mode === "personalized";
  const selectedChannel = viewingMine
    ? ""
    : String(searchParams.get("channel") || "").trim();

  const pageTitle = isGuest ? "Explore" : viewingMine ? "My Posts" : "Feed";
  const pageSubtitle = isGuest
    ? "Discover public posts across Fointer communities."
    : viewingMine
      ? "Posts you have created. Community is optional."
      : "Discover what's happening in your communities or explore public posts.";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [otherCommunities, setOtherCommunities] = useState([]);
  const [otherCommunitiesLoading, setOtherCommunitiesLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [postForm, setPostForm] = useState(EMPTY_POST_FORM);
  const [postSaving, setPostSaving] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState([]);

  const viewingPost = Boolean(postSlug);

  const feedQueryString = useMemo(() => {
    const next = new URLSearchParams();
    if (viewingMine) next.set("mine", "1");
    else if (isPersonalized) next.set("mode", "personalized");
    if (!viewingMine && selectedChannel) next.set("channel", selectedChannel);
    const s = next.toString();
    return s ? `?${s}` : "";
  }, [isPersonalized, selectedChannel, viewingMine]);

  const feedBase = feedQueryString
    ? `${activeFeedPath}${feedQueryString}`
    : activeFeedPath;

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
    next.delete("mine");
    next.delete("compose");
    if (nextMode === "personalized") next.set("mode", "personalized");
    else next.delete("mode");
    setSearchParams(next, { replace: true });
    setSortBy("newest");
    setPosts([]);
  };

  const setMineView = (on) => {
    if (isGuest) {
      navigate("/login", { state: { from: `${FEED_PATH}?mine=1` } });
      return;
    }
    const next = new URLSearchParams();
    if (on) next.set("mine", "1");
    setFiltersOpen(false);
    setSearchParams(next, { replace: true });
    setSortBy("newest");
    setPosts([]);
  };

  const openCreate = () => {
    if (isGuest) {
      navigate("/login", { state: { from: `${FEED_PATH}?compose=1` } });
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("compose", "1");
    setPostForm(EMPTY_POST_FORM);
    setSearchParams(next);
  };

  const closeCreate = () => {
    if (postSaving) return;
    const next = new URLSearchParams(searchParams);
    next.delete("compose");
    setPostForm(EMPTY_POST_FORM);
    setSearchParams(next, { replace: true });
  };

  const setChannel = (channelName) => {
    const next = new URLSearchParams(searchParams);
    const value = String(channelName || "").trim();
    if (value) next.set("channel", value);
    else next.delete("channel");
    if (viewingPost) {
      const qs = next.toString();
      navigate(qs ? `${activeFeedPath}?${qs}` : activeFeedPath);
    } else {
      setSearchParams(next, { replace: true });
    }
    setPosts([]);
  };

  const load = useCallback(
    async ({
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
        if (viewingMine) {
          params.mine = "1";
        } else if (channel) {
          params.channel = channel;
        }
        const data =
          viewingMine || feedMode === "personalized"
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
    [showToast, mode, selectedChannel, viewingMine]
  );

  useEffect(() => {
    if (viewingPost || composing) return;
    load({
      pageNum: 1,
      append: false,
      sort: sortBy,
      feedMode: mode,
      channel: selectedChannel,
    });
  }, [load, sortBy, mode, selectedChannel, viewingPost, composing, viewingMine]);

  useEffect(() => {
    if (viewingPost) {
      setChannelsLoading(false);
      return undefined;
    }
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
  }, [viewingPost]);

  useEffect(() => {
    if (viewingPost) {
      setOtherCommunitiesLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setOtherCommunitiesLoading(true);
      try {
        const data = await fetchBrowsableCommunities({
          limit: 6,
          sortBy: "members",
        });
        if (!cancelled) {
          setOtherCommunities(data?.communities || []);
        }
      } catch {
        if (!cancelled) setOtherCommunities([]);
      } finally {
        if (!cancelled) setOtherCommunitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, viewingPost]);

  useEffect(() => {
    if (viewingPost) {
      setBannersLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setBannersLoading(true);
      try {
        const data = await fetchActiveBanners();
        if (!cancelled) setBanners(data?.banners || []);
      } catch {
        if (!cancelled) setBanners([]);
      } finally {
        if (!cancelled) setBannersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewingPost]);

  useEffect(() => {
    if (viewingPost) {
      setTrendingLoading(false);
      return undefined;
    }
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
  }, [viewingPost]);

  useEffect(() => {
    if (!composing) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJoinedCommunities();
        if (!cancelled) setJoinedCommunities(data?.communities || []);
      } catch {
        if (!cancelled) setJoinedCommunities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [composing]);

  const openPost = (post) => {
    navigate(`${FEED_POST_PATH}/${postSegment(post)}${feedQueryString}`);
  };

  const closePost = useCallback(() => {
    navigate(feedBase);
  }, [navigate, feedBase]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postForm.title.trim()) {
      showToast("Title is required.");
      return;
    }
    setPostSaving(true);
    try {
      const payload = {
        title: postForm.title.trim(),
        text: postForm.text.trim(),
        media: postForm.media,
      };
      if (postForm.communityId) payload.communityId = postForm.communityId;
      const res = await createPost(payload);
      setPostForm(EMPTY_POST_FORM);
      showToast("Post created.");
      const created = res?.post;
      if (created?.id) {
        navigate(`${FEED_POST_PATH}/${postSegment(created)}?mine=1`);
      } else {
        const next = new URLSearchParams();
        next.set("mine", "1");
        setSearchParams(next, { replace: true });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create post.");
    } finally {
      setPostSaving(false);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    load({
      pageNum: page + 1,
      append: true,
      sort: sortBy,
      feedMode: mode,
      channel: selectedChannel,
    });
  };

  const locationPath = () =>
    `${window.location.pathname}${window.location.search}`;

  const requireEngage = (post) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: locationPath() } });
      return false;
    }
    if (post?.canEngage === false) {
      showToast(
        post.community
          ? "Join this community to interact with posts."
          : "You cannot interact with this post."
      );
      return false;
    }
    return true;
  };

  const patchFeedPost = (postId, patch) => {
    setPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, ...patch } : p))
    );
  };

  const handleLikePost = async (post) => {
    if (!requireEngage(post)) return;
    const prev = posts;
    patchFeedPost(post.id, {
      likedByMe: !post.likedByMe,
      likeCount: post.likedByMe
        ? Math.max(0, (post.likeCount || 0) - 1)
        : (post.likeCount || 0) + 1,
    });
    try {
      const data = await togglePostLike(post.id);
      patchFeedPost(post.id, {
        likedByMe: data.likedByMe,
        likeCount: data.likeCount,
      });
    } catch (err) {
      setPosts(prev);
      showToast(err?.response?.data?.message || "Failed to like post.");
    }
  };

  const handleResharePost = async (post) => {
    if (!requireEngage(post)) return;
    const prev = posts;
    patchFeedPost(post.id, {
      resharedByMe: !post.resharedByMe,
      reshareCount: post.resharedByMe
        ? Math.max(0, (post.reshareCount || 0) - 1)
        : (post.reshareCount || 0) + 1,
    });
    try {
      const data = await togglePostReshare(post.id);
      patchFeedPost(post.id, {
        resharedByMe: data.resharedByMe,
        reshareCount: data.reshareCount,
      });
    } catch (err) {
      setPosts(prev);
      showToast(err?.response?.data?.message || "Failed to repost.");
    }
  };

  const categoryProps = {
    channels,
    channelsLoading,
    selectedChannel,
    onSelectChannel: (name) => {
      setChannel(name);
      setFiltersOpen(false);
    },
    communities: otherCommunities,
    communitiesLoading: otherCommunitiesLoading,
    trendingTopics,
    trendingLoading,
  };

  const filterToggle = (
    <FeedFilterToggle
      open={filtersOpen}
      active={Boolean(selectedChannel)}
      onClick={() => setFiltersOpen((v) => !v)}
      controlsId={FILTERS_PANEL_ID}
    />
  );

  if (viewingPost) {
    return (
      <div className="text-fo-text w-full pb-6">
        {resolvingPost ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-fo-muted">
            <Loader2 size={16} className="animate-spin text-fo-accent" />
            Loading post…
          </div>
        ) : postNotFound || !openPostId ? (
          <div className="max-w-[1180px] mx-auto">
            <button
              type="button"
              onClick={closePost}
              className="inline-flex items-center gap-2 min-h-9 px-1 mb-3 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
            >
              <ArrowLeft size={16} /> Back to posts
            </button>
            <div className="border border-dashed border-fo-border rounded-xl py-12 text-center text-sm text-fo-subtle">
              Post not found.
            </div>
          </div>
        ) : (
          <PostDetail
            key={`${postSlug}-${mode}`}
            postId={openPostId}
            embedded
            compact={false}
            fetchPostFn={isPersonalized ? fetchPost : fetchPublicPost}
            onBack={closePost}
            backLabel={viewingMine ? "Back to my posts" : "Back to posts"}
            onDeleted={() => {
              closePost();
              load({
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
        )}
      </div>
    );
  }

  if (composing) {
    return (
      <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
        <CreatePostForm
          title={postForm.title}
          text={postForm.text}
          media={postForm.media}
          onTitleChange={(title) => setPostForm((f) => ({ ...f, title }))}
          onTextChange={(text) => setPostForm((f) => ({ ...f, text }))}
          onMediaChange={(media) => setPostForm((f) => ({ ...f, media }))}
          onSubmit={handleCreatePost}
          onCancel={closeCreate}
          saving={postSaving}
          showCommunitySelect
          communities={joinedCommunities}
          communityId={postForm.communityId}
          onCommunityChange={(communityId) =>
            setPostForm((f) => ({ ...f, communityId }))
          }
          onError={showToast}
        />
      </div>
    );
  }

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      {viewingMine ? (
        <button
          type="button"
          onClick={() => setMineView(false)}
          className="inline-flex items-center gap-2 min-h-9 px-1 mb-3 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
        >
          <ArrowLeft size={16} /> Back to feed
        </button>
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <FeedHeroBanner banners={banners} loading={bannersLoading} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fo-text leading-tight">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug max-w-xl">
                {pageSubtitle}
              </p>
              {selectedChannel ? (
                <button
                  type="button"
                  onClick={() => setChannel("")}
                  className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg text-xs bg-fo-accent/15 text-fo-accent hover:bg-fo-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <Hash size={11} aria-hidden />
                  {selectedChannel}
                  <span className="opacity-70" aria-hidden>
                    ×
                  </span>
                  <span className="sr-only">Clear category filter</span>
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
              {!isGuest ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMineView(true)}
                    className={`inline-flex items-center min-h-9 px-3.5 rounded-full border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                      viewingMine
                        ? "border-fo-accent/45 text-fo-accent bg-fo-accent/10"
                        : "border-fo-border text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
                    }`}
                  >
                    My Posts
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                  >
                    <Plus size={16} aria-hidden />
                    Create Post
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {!viewingMine ? (
            <div className="flex items-center justify-between gap-2">
              <div
                className="inline-flex gap-1 p-1 rounded-full bg-fo-surface border border-fo-border shadow-[0_1px_2px_rgba(26,22,18,0.04)] min-w-0 overflow-x-auto"
                role="group"
                aria-label="Feed mode"
              >
                {FEED_MODES.map((m) => {
                  const active = mode === m.id;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      aria-pressed={active}
                      className={modeBtnClass(active)}
                    >
                      <Icon size={15} aria-hidden />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {filterToggle}
            </div>
          ) : null}
          <div
            className="flex flex-wrap items-center gap-1 border-b border-fo-border pb-1"
            role="group"
            aria-label="Sort posts"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  aria-pressed={active}
                  className={sortBtnClass(active)}
                >
                  {opt.label}
                  {active ? (
                    <span className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-fo-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="space-y-2 sm:space-y-3" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading feed…</span>
              <FeedPostSkeleton />
              <FeedPostSkeleton />
              <FeedPostSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-fo-subtle text-sm px-4 space-y-3">
              {viewingMine ? (
                <>
                  <p>No posts yet. Create your first post.</p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
                  >
                    <Plus size={14} /> Create Post
                  </button>
                </>
              ) : selectedChannel ? (
                <>
                  <p>No posts found in {selectedChannel}.</p>
                  <button
                    type="button"
                    onClick={() => setChannel("")}
                    className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
                  >
                    Clear category filter
                  </button>
                </>
              ) : isPersonalized ? (
                <>
                  <p>No posts yet from communities you have joined.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/communities"
                      className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                    >
                      Joined communities <ArrowRight size={14} />
                    </Link>
                    <Link
                      to="/communities/manage"
                      className="inline-flex items-center gap-2 text-fo-muted hover:text-fo-accent font-medium"
                    >
                      Manage communities <ArrowRight size={14} />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    {isGuest
                      ? "No public posts to show yet. Browse communities or create an account to join the conversation."
                      : "No public posts to show yet."}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/communities"
                      className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                    >
                      Browse communities <ArrowRight size={14} />
                    </Link>
                    {isGuest ? (
                      <Link
                        to="/signup"
                        className="inline-flex items-center gap-2 text-fo-muted hover:text-fo-accent font-medium"
                      >
                        Sign up <ArrowRight size={14} />
                      </Link>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <FeedPostRow
                    key={post.id}
                    post={post}
                    variant="card"
                    onOpen={() => openPost(post)}
                    showCommunity
                    onLike={() => handleLikePost(post)}
                    onReshare={() => handleResharePost(post)}
                    onComment={() => openPost(post)}
                  />
                ))}
              </div>

              {hasMore ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center gap-2 min-h-10 px-5 py-2.5 rounded-lg border border-fo-border text-sm text-fo-text hover:border-fo-accent/50 hover:text-fo-accent disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                  >
                    {loadingMore ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-fo-accent"
                      />
                    ) : null}
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <FeedDesktopRail {...categoryProps} isGuest={isGuest} />
        </div>
      </div>

      <div className="lg:hidden mt-4">
        <FeedFooterRail isGuest={isGuest} />
      </div>

      <FeedMobileFilters
        open={filtersOpen && !viewingMine}
        onClose={() => setFiltersOpen(false)}
        channels={channels}
        channelsLoading={channelsLoading}
        selectedChannel={selectedChannel}
        onSelectChannel={(name) => {
          setChannel(name);
          setFiltersOpen(false);
        }}
        communities={otherCommunities}
        communitiesLoading={otherCommunitiesLoading}
        trendingTopics={trendingTopics}
        trendingLoading={trendingLoading}
      />
    </div>
  );
}
