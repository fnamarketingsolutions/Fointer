import React, { useCallback, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuGlobe as Globe,
  LuLoaderCircle as Loader2,
  LuLock as Lock,
  LuPlus as Plus,
  LuRadio as Radio,
  LuSearch as Search,
  LuUsers as Users,
  LuVideo as Video
} from "react-icons/lu";
import {
  acceptInvite,
  declineInvite,
  fetchBrowsableCommunity,
  joinPublicCommunity,
  requestToJoin,
} from "../../../../api/communities";
import { createPost, fetchPost, fetchPosts, togglePostLike, togglePostReshare } from "../../../../api/posts";
import { fetchLiveEvents } from "../../../../api/liveEvents";
import { fetchWatchGroups } from "../../../../api/watchGroups";
import PostDetail from "../../../posts/pages/PostDetail";
import CreatePostForm from "../../../../shared/components/forms/CreatePostForm";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import useEntityId from "../../../../shared/hooks/useEntityId";
import {
  postSegment,
} from "../../../../shared/services/entityLinks";
import { useAuth } from "../../../../context/AuthContext";
import { timeAgo } from "../../../../shared/utils/date";
import { formatCount } from "../../../../shared/utils/format";
import PostActions from "../../../../shared/components/PostActions";
import UserProfileLink from "../../../../shared/components/UserProfileLink";

const PAGE_SIZE = 15;

const SORT_OPTIONS = [
  { id: "newest", label: "New" },
  { id: "likes", label: "Top" },
  { id: "comments", label: "Discussed" },
];

const TYPE_ICONS = {
  public: Globe,
  private_invite: Lock,
  private_request: Lock,
};

function FeedPostRow({ post, onClick, active, onLike, onReshare, onComment }) {
  const authorName =
    post?.author?.name || post?.author?.username || "Anonymous";
  const coverImage = post?.media?.find((m) => m.type === "image");

  return (
    <article
      onClick={onClick}
      className={`group flex gap-3 bg-fo-surface border rounded-xl overflow-hidden cursor-pointer transition-colors p-3 sm:p-4 ${
        active
          ? "border-fo-accent/50"
          : "border-fo-border hover:border-fo-accent/35"
      }`}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
          <UserProfileLink
            author={post?.author}
            className="font-semibold text-fo-muted hover:text-fo-accent transition-colors"
          >
            {authorName}
          </UserProfileLink>
          <span>·</span>
          <span>{timeAgo(post?.createdAt)}</span>
        </div>

        <h2 className="text-sm sm:text-base font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
          {post?.title || "Untitled"}
        </h2>

        {post?.text ? (
          <p className="text-xs sm:text-sm text-fo-muted line-clamp-2 leading-relaxed">
            {post.text}
          </p>
        ) : null}

        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <PostActions
            post={post}
            compact
            onLike={onLike}
            onReshare={onReshare}
            onComment={onComment}
          />
        </div>
      </div>

      {coverImage ? (
        <div className="hidden sm:block w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-fo-surface-2 border border-fo-border">
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

function CommunitySidebar({
  community,
  liveEvents,
  liveLoading,
  watchGroups,
  watchLoading,
}) {
  const typeLabel =
    COMMUNITY_TYPE_LABELS[community?.type] || community?.type || "Community";
  const TypeIcon = TYPE_ICONS[community?.type] || Globe;
  const ownerName =
    community?.owner?.name || community?.owner?.username || "Owner";
  const rules = (community?.rules || "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <aside className="space-y-4">
      <div className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
        {community?.coverImage ? (
          <div className="h-24 bg-fo-surface-2">
            <img
              src={community.coverImage}
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        ) : (
          <div className="h-16 bg-gradient-to-br from-[#1C1612] to-[#0A0806]" />
        )}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fo-text leading-snug">
              {community?.name}
            </h3>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-fo-subtle capitalize">
              <TypeIcon size={11} className="text-fo-accent" />
              {typeLabel}
            </p>
          </div>

          {community?.description ? (
            <p className="text-xs text-fo-muted leading-relaxed line-clamp-4">
              {community.description}
            </p>
          ) : null}

          <div className="flex items-center gap-3 text-[11px] text-fo-subtle pt-1 border-t border-fo-border">
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="text-fo-accent" />
              {formatCount(community?.memberCount || 0)} members
            </span>
            <span>·</span>
            <UserProfileLink
              author={community?.owner}
              className="hover:text-fo-accent transition-colors"
            >
              {ownerName}
            </UserProfileLink>
          </div>
        </div>
      </div>

      {rules.length > 0 ? (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-fo-text">Rules</h4>
          <ol className="space-y-1.5">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-2 text-xs text-fo-muted">
                <span className="text-fo-accent font-semibold shrink-0">
                  {i + 1}.
                </span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
          <Video size={15} className="text-red-400" />
          Live now
        </div>
        {liveLoading ? (
          <div className="flex items-center gap-2 text-xs text-fo-subtle">
            <Loader2 size={12} className="animate-spin text-fo-accent" />
            Loading…
          </div>
        ) : liveEvents.length === 0 ? (
          <p className="text-xs text-fo-subtle">No live events.</p>
        ) : (
          <ul className="space-y-2">
            {liveEvents.slice(0, 4).map((ev) => (
              <li key={ev.id}>
                <Link
                  to={`/live-events/${ev.id}`}
                  className="block text-xs text-fo-text hover:text-fo-accent line-clamp-2"
                >
                  {ev.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
          <Radio size={15} className="text-fo-accent" />
          Watch groups
        </div>
        {watchLoading ? (
          <div className="flex items-center gap-2 text-xs text-fo-subtle">
            <Loader2 size={12} className="animate-spin text-fo-accent" />
            Loading…
          </div>
        ) : watchGroups.length === 0 ? (
          <p className="text-xs text-fo-subtle">No watch groups.</p>
        ) : (
          <ul className="space-y-2">
            {watchGroups.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Link
                  to={`/watch-groups/${g.id}`}
                  className="block text-xs text-fo-text hover:text-fo-accent line-clamp-2"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default function CommunityFeed() {
  const navigate = useNavigate();
  const { communityId: communityParam, postSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const { id: communityId, resolving: resolvingCommunity } = useEntityId(
    "community",
    communityParam
  );
  const { id: openPostId, resolving: resolvingPost, notFound: postNotFound } =
    useEntityId("post", postSlug);

  const inviteId = searchParams.get("invite") || null;

  const [community, setCommunity] = useState(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [watchGroups, setWatchGroups] = useState([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", text: "", media: [] });
  const [postSaving, setPostSaving] = useState(false);

  const viewingPost = Boolean(postSlug);
  const basePath = communityParam
    ? `/communities/${communityParam}`
    : "/communities";

  const loadCommunity = useCallback(async () => {
    if (!communityId) return;
    setCommunityLoading(true);
    try {
      const data = await fetchBrowsableCommunity(communityId);
      setCommunity(data?.community || null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load community.");
      setCommunity(null);
    } finally {
      setCommunityLoading(false);
    }
  }, [communityId, showToast]);

  const loadPosts = useCallback(
    async ({
      q = "",
      pageNum = 1,
      append = false,
      sort = "newest",
    } = {}) => {
      if (!communityId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = {
          communityId,
          page: pageNum,
          limit: PAGE_SIZE,
          sortBy: sort,
        };
        if (q.trim()) params.q = q.trim();
        const data = await fetchPosts(params);
        const next = data?.posts || [];
        setPosts((prev) => (append ? [...prev, ...next] : next));
        setHasMore(Boolean(data?.pagination?.hasMore));
        setPage(pageNum);
      } catch (err) {
        showToast(err?.response?.data?.message || "Unable to load posts.");
        if (!append) setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [communityId, showToast]
  );

  useEffect(() => {
    if (!communityId) return;
    loadCommunity();
  }, [communityId, loadCommunity]);

  useEffect(() => {
    if (!communityId || !community?.isMember) {
      setPosts([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    loadPosts({ q: query, pageNum: 1, append: false, sort: sortBy });
  }, [communityId, community?.isMember, query, sortBy, loadPosts]);

  useEffect(() => {
    if (!isAuthenticated || !communityId) return;
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      try {
        const data = await fetchLiveEvents({
          communityId,
          status: "live",
        });
        if (!cancelled) setLiveEvents(data?.events || []);
      } catch {
        if (!cancelled) setLiveEvents([]);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchGroups([]);
      setWatchLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setWatchLoading(true);
      try {
        const data = await fetchWatchGroups();
        if (!cancelled) {
          setWatchGroups(
            (data?.groups || [])
              .filter((g) => g.type === "public" || g.isMember)
              .slice(0, 6)
          );
        }
      } catch {
        if (!cancelled) setWatchGroups([]);
      } finally {
        if (!cancelled) setWatchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const openPost = (post) => {
    navigate(`${basePath}/posts/${postSegment(post)}`);
  };

  const closePost = useCallback(() => {
    navigate(basePath);
  }, [navigate, basePath]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    loadPosts({
      q: query,
      pageNum: page + 1,
      append: true,
      sort: sortBy,
    });
  };

  const patchFeedPost = (postId, patch) => {
    setPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, ...patch } : p))
    );
  };

  const requireEngage = (post) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: window.location.pathname } });
      return false;
    }
    if (post?.canEngage === false) {
      showToast("Join this community to interact with posts.");
      return false;
    }
    return true;
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

  const handleJoin = async () => {
    if (!community) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    setJoining(true);
    try {
      if (community.type === "public") {
        await joinPublicCommunity(community.id);
        showToast("Joined community.");
      } else if (community.type === "private_request") {
        await requestToJoin(community.id, { message: joinMessage.trim() });
        showToast("Join request sent.");
      }
      await loadCommunity();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteId) return;
    setInviteBusy(true);
    try {
      await acceptInvite(inviteId);
      showToast("Invite accepted.");
      const next = new URLSearchParams(searchParams);
      next.delete("invite");
      setSearchParams(next, { replace: true });
      await loadCommunity();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to accept invite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleDeclineInvite = async () => {
    if (!inviteId) return;
    setInviteBusy(true);
    try {
      await declineInvite(inviteId);
      showToast("Invite declined.");
      navigate("/communities");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to decline invite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!communityId || !postForm.title.trim()) {
      showToast("Post title is required.");
      return;
    }
    setPostSaving(true);
    try {
      const res = await createPost({
        communityId,
        title: postForm.title.trim(),
        text: postForm.text.trim(),
        media: postForm.media,
      });
      setShowCreatePost(false);
      setPostForm({ title: "", text: "", media: [] });
      showToast("Post created.");
      const created = res?.post;
      if (created?.id) {
        openPost(created);
      } else {
        await loadPosts({ q: query, pageNum: 1, append: false, sort: sortBy });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create post.");
    } finally {
      setPostSaving(false);
    }
  };

  const canJoinPublic =
    community?.type === "public" &&
    !community?.isMember &&
    !community?.joinRequestPending;
  const canRequestJoin =
    community?.type === "private_request" &&
    !community?.isMember &&
    !community?.joinRequestPending;

  const sidebar = community ? (
    <CommunitySidebar
      community={community}
      liveEvents={liveEvents}
      liveLoading={liveLoading}
      watchGroups={watchGroups}
      watchLoading={watchLoading}
    />
  ) : null;

  if (resolvingCommunity || (communityLoading && !community)) {
    return (
      <div className="flex items-center justify-center py-16 text-fo-muted text-sm gap-2">
        <Loader2 size={16} className="animate-spin text-fo-accent" />
        Loading community…
      </div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-3">
        <p className="text-sm text-fo-subtle">Community not found.</p>
        <Link
          to="/communities"
          className="inline-flex items-center gap-1.5 text-sm text-fo-accent hover:text-fo-accent-hover"
        >
          <ArrowLeft size={14} /> Back to Communities
        </Link>
      </div>
    );
  }

  if (showCreatePost) {
    return (
      <div className="text-fo-text w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
        <CreatePostForm
          title={postForm.title}
          text={postForm.text}
          media={postForm.media}
          onTitleChange={(title) => setPostForm((f) => ({ ...f, title }))}
          onTextChange={(text) => setPostForm((f) => ({ ...f, text }))}
          onMediaChange={(media) => setPostForm((f) => ({ ...f, media }))}
          onSubmit={handleCreatePost}
          onCancel={() => {
            if (postSaving) return;
            setShowCreatePost(false);
            setPostForm({ title: "", text: "", media: [] });
          }}
          saving={postSaving}
          communityLabel={community.name}
          onError={showToast}
        />
      </div>
    );
  }

  if (viewingPost) {
    return (
      <div className="text-fo-text w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
        <button
          type="button"
          onClick={closePost}
          className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent mb-4"
        >
          <ArrowLeft size={14} /> Back to {community.name}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="min-w-0 bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
            {resolvingPost ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-fo-muted">
                <Loader2 size={16} className="animate-spin text-fo-accent" />
                Loading post…
              </div>
            ) : postNotFound || !openPostId ? (
              <div className="border border-dashed border-fo-border rounded-xl m-4 py-14 text-center text-sm text-fo-subtle">
                Post not found.
              </div>
            ) : (
              <PostDetail
                key={postSlug}
                postId={openPostId}
                embedded
                compact={false}
                fetchPostFn={fetchPost}
                onBack={closePost}
                onDeleted={() => {
                  closePost();
                  loadPosts({
                    q: query,
                    pageNum: 1,
                    append: false,
                    sort: sortBy,
                  });
                }}
                postPathBuilder={(post) =>
                  `${basePath}/posts/${postSegment(post)}`
                }
              />
            )}
          </div>
          <div className="lg:sticky lg:top-4 space-y-4 order-first lg:order-none">
            {sidebar}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-fo-text w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
      <div className="mb-5 sm:mb-6 space-y-4">
        <Link
          to="/communities"
          className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent"
        >
          <ArrowLeft size={14} /> Communities
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-fo-text leading-tight truncate">
              {community.name}
            </h1>
            <p className="text-sm text-fo-subtle max-w-xl line-clamp-2">
              {community.description ||
                "Posts and discussion from this community."}
            </p>
          </div>

          {community.isMember ? (
            <button
              type="button"
              onClick={() => setShowCreatePost(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover shrink-0"
            >
              <Plus size={14} /> Create post
            </button>
          ) : null}
        </div>

        {inviteId ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fo-accent/35 bg-fo-accent/10 px-4 py-3">
            <p className="text-xs text-fo-text flex-1 min-w-0">
              You have a pending invite to this community.
            </p>
            <button
              type="button"
              disabled={inviteBusy}
              onClick={handleDeclineInvite}
              className="px-3 py-1.5 rounded-lg text-xs border border-fo-border text-fo-muted hover:text-fo-text disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={inviteBusy}
              onClick={handleAcceptInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-fo-accent text-black font-semibold disabled:opacity-50"
            >
              {inviteBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : null}
              Accept
            </button>
          </div>
        ) : null}

        {!community.isMember && !inviteId ? (
          <div className="rounded-xl border border-fo-border bg-fo-surface px-4 py-3 space-y-2">
            {community.joinRequestPending ? (
              <p className="text-xs text-fo-accent">
                Your join request is pending.
              </p>
            ) : canJoinPublic ? (
              <button
                type="button"
                disabled={joining}
                onClick={handleJoin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
              >
                {joining ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Users size={12} />
                )}
                Join community
              </button>
            ) : canRequestJoin ? (
              <div className="space-y-2">
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  rows={2}
                  placeholder="Optional message to the moderators…"
                  className="w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2 text-xs text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle"
                />
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoin}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
                >
                  {joining ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : null}
                  Request to join
                </button>
              </div>
            ) : (
              <p className="text-xs text-fo-subtle">
                This community is invite-only.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="min-w-0 space-y-4">
          {community.isMember ? (
            <>
              <form
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
                  />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search posts in this community…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-fo-surface border border-fo-border text-fo-text text-sm placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-fo-accent text-black text-sm font-semibold hover:bg-fo-accent-hover shrink-0"
                >
                  Search
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 border-b border-fo-border pb-3">
                {SORT_OPTIONS.map((opt) => {
                  const active = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? "bg-fo-accent/15 text-fo-accent"
                          : "text-fo-subtle hover:text-fo-text hover:bg-fo-surface-hover"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-fo-muted text-sm gap-2">
                  <Loader2 size={18} className="animate-spin text-fo-accent" />
                  Loading posts…
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-fo-subtle text-sm px-4 space-y-3">
                  <p>
                    {query
                      ? `No posts match “${query}”.`
                      : "No posts in this community yet."}
                  </p>
                  {!query ? (
                    <button
                      type="button"
                      onClick={() => setShowCreatePost(true)}
                      className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                    >
                      <Plus size={14} /> Create the first post
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <FeedPostRow
                        key={post.id}
                        post={post}
                        onClick={() => openPost(post)}
                        active={String(post.id) === String(openPostId)}
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
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-fo-border text-sm text-fo-text hover:border-fo-accent/50 hover:text-fo-accent disabled:opacity-60 transition-colors"
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
            </>
          ) : (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-fo-subtle text-sm px-4">
              Join this community to see its posts and discussions.
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-4">{sidebar}</div>
      </div>

      <div className="lg:hidden mt-8">{sidebar}</div>
    </div>
  );
}
