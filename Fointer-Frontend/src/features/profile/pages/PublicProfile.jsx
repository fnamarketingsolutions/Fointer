import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuAward as Award,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuStore as StoreIcon,
} from "react-icons/lu";
import { fetchPublicProfile } from "../../../api/profile";
import { useAuth } from "../../../context/AuthContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import ProfilePhotoViewer from "../../../shared/components/ProfilePhotoViewer";
import FeedPostRow from "../../../shared/components/FeedPostRow";
import {
  communitySegment,
  postSegment,
} from "../../../shared/services/entityLinks";
import { normalizeUsername } from "../../../shared/services/profileLinks";
import FollowButton from "../../../shared/components/FollowButton";
import FollowUserList from "../components/FollowUserList";
import CommunityCard from "../../communities/components/CommunityCard";
import { createConversation } from "../../../api/messages";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { timeAgo } from "../../../shared/utils/date";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import { categoryLabel, formatLocation } from "../../marketplace/constants";
import { fetchPublicStores } from "../../stores/services/storeService";

const TABS = [
  { id: "about", label: "About" },
  { id: "posts", label: "Posts" },
  { id: "reposts", label: "Reposts" },
  { id: "communities", label: "Communities" },
  { id: "stores", label: "Stores" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const TAB_IDS = new Set(TABS.map((item) => item.id));

const tabBtnClass = (active) =>
  `relative shrink-0 px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg ${
    active ? "text-fo-accent" : "text-fo-subtle hover:text-fo-text"
  }`;

function postPath(post) {
  const postSeg = postSegment(post) || post.id;
  const communitySeg = post.community
    ? communitySegment(post.community) || post.community.id
    : null;
  return communitySeg
    ? `/communities/${communitySeg}/posts/${postSeg}`
    : `/post/${postSeg}`;
}

function EmptyState({ children }) {
  return (
    <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4">
      {children}
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedUsername, setLoadedUsername] = useState("");
  const [error, setError] = useState("");
  const [messaging, setMessaging] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [storesResult, setStoresResult] = useState(null);
  const [storesRetry, setStoresRetry] = useState(0);

  const tabParam = searchParams.get("tab");
  const tab = TAB_IDS.has(tabParam) ? tabParam : "about";

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id || id === "about") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPublicProfile(username);
      setProfile(data?.profile || null);
    } catch (err) {
      setProfile(null);
      setError(err?.response?.data?.message || "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicProfile(username)
      .then((data) => {
        if (cancelled) return;
        setProfile(data?.profile || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setProfile(null);
        setError(err?.response?.data?.message || "Could not load profile.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadedUsername(username);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (tab !== "stores" || !profile?.id) return undefined;

    let cancelled = false;
    const requestKey = `${profile.id}:${storesRetry}`;

    fetchPublicStores({ owner: profile.id, page: 1, limit: 50 })
      .then((data) => {
        if (!cancelled) {
          setStoresResult({
            key: requestKey,
            stores: data?.stores || [],
            error: "",
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStoresResult({
          key: requestKey,
          stores: [],
          error:
            err?.response?.data?.message ||
            "Could not load this user's stores.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tab, profile?.id, storesRetry]);

  const storesRequestKey = `${profile?.id || ""}:${storesRetry}`;
  const storesResultMatches = storesResult?.key === storesRequestKey;
  const storesLoading = tab === "stores" && !storesResultMatches;
  const stores = storesResultMatches ? storesResult.stores : [];
  const storesError = storesResultMatches ? storesResult.error : "";

  useEffect(() => {
    const clean = normalizeUsername(username);
    const me = normalizeUsername(user?.username);
    if (user && clean && me === clean) {
      navigate("/profile", { replace: true });
    }
  }, [user, username, navigate]);

  const author = useMemo(
    () =>
      profile
        ? {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            avatar: profile.avatar,
          }
        : null,
    [profile]
  );

  const shell = (content) => (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 min-h-9 px-1 mb-3 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      <div className="min-w-0">{content}</div>
    </div>
  );

  if (loading || loadedUsername !== username) {
    return shell(
      <div className="space-y-3" aria-busy="true">
        <div className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden animate-pulse p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fo-surface-hover shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 w-48 rounded bg-fo-surface-hover" />
              <div className="h-3 w-28 rounded bg-fo-surface-hover" />
              <div className="h-3 w-72 max-w-full rounded bg-fo-surface-hover" />
            </div>
          </div>
        </div>
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  if (error || !profile) {
    return shell(
      <div className="border border-dashed border-fo-border rounded-xl py-14 px-4 text-center space-y-3">
        <p className="text-sm text-fo-text font-medium">
          {error ? "Could not load profile" : "Profile not found"}
        </p>
        <p className="text-xs text-fo-subtle">
          {error || "This user may not exist or is unavailable."}
        </p>
        {error ? (
          <button
            type="button"
            onClick={loadProfile}
            className="inline-flex items-center gap-2 min-h-9 px-4 rounded-full border border-fo-border text-[13px] font-medium text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const postCount = profile.stats?.posts || profile.posts?.length || 0;
  const repostCount = profile.stats?.reposts || profile.reposts?.length || 0;
  const communityCount =
    profile.stats?.communitiesJoined || profile.communities?.length || 0;
  const followerCount = profile.stats?.followers ?? 0;
  const followingCount = profile.stats?.following ?? 0;
  const handle = normalizeUsername(profile.username);
  const profilePath = `/users/${handle || username}`;
  const displayName = profile.name || profile.username;

  const tabCounts = {
    posts: postCount,
    reposts: repostCount,
    communities: communityCount,
    followers: followerCount,
    following: followingCount,
  };

  const handleFollowChange = ({ following, followerCount: nextFollowers }) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: following,
            stats: {
              ...prev.stats,
              followers:
                nextFollowers !== undefined
                  ? nextFollowers
                  : prev.stats?.followers,
            },
          }
        : prev
    );
  };

  const handleMessage = async () => {
    if (!user) {
      navigate("/login", { state: { from: profilePath } });
      return;
    }
    setMessaging(true);
    try {
      const res = await createConversation({
        userId: profile.id,
        username: profile.username,
      });
      const id = res?.conversation?.id;
      if (id) navigate(`/messages/${id}`);
      else showToast("Could not start conversation.");
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Could not start conversation."
      );
    } finally {
      setMessaging(false);
    }
  };

  const requireAuthForFollow = () => {
    navigate("/login", { state: { from: profilePath } });
  };

  const followClass =
    "inline-flex items-center justify-center gap-2 min-h-9 px-3.5 rounded-full text-[13px] font-semibold disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40";

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={handleMessage}
        disabled={messaging}
        className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
      >
        {messaging ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <MessageCircle size={14} />
        )}
        Message
      </button>
      {user ? (
        <FollowButton
          username={profile.username}
          initialFollowing={Boolean(profile.isFollowing)}
          initialFollowedBy={Boolean(profile.isFollowedBy)}
          onChange={handleFollowChange}
          className={`${followClass} ${
            profile.isFollowing
              ? "border border-fo-border text-fo-text hover:border-red-500/40 hover:text-red-500"
              : "bg-fo-accent text-black hover:bg-fo-accent-hover"
          }`}
        />
      ) : (
        <button
          type="button"
          onClick={requireAuthForFollow}
          className={`${followClass} bg-fo-accent text-black hover:bg-fo-accent-hover`}
        >
          {profile.isFollowedBy ? "Follow Back" : "Follow"}
        </button>
      )}
    </div> 
  );

  return shell(
    <div className="space-y-3">
      <article className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {profile.avatar ? (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                title="View profile photo"
                aria-label="View profile photo"
                className="rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
              >
                <ProfileAvatar
                  src={profile.avatar}
                  alt={displayName}
                  name={displayName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-fo-border shrink-0"
                />
              </button>
            ) : (
              <ProfileAvatar
                src={profile.avatar}
                alt={displayName}
                name={displayName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-fo-border shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-fo-text leading-tight">
                {displayName}
              </h1>
              <p className="mt-0.5 text-sm text-fo-subtle">@{handle}</p>
            </div>
          </div>
          {actionButtons}
        </div>

        {profile.achievements?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.achievements.map((badge) => (
              <button
                key={badge.id}
                type="button"
                title={badge.description}
                onClick={() => setTab("about")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-fo-border bg-fo-bg text-[11px] text-fo-muted hover:border-fo-accent/40 hover:text-fo-text transition-colors"
              >
                <Award size={11} className="text-fo-accent" />
                {badge.label}
              </button>
            ))}
          </div>
        ) : null}
      </article>

      <div
        className="flex items-center gap-1 w-full min-w-0 max-w-full border-b border-fo-border pb-1 overflow-x-auto overscroll-x-contain fointer-scrollbar flex-nowrap [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label="Profile sections"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const count = tabCounts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={tabBtnClass(active)}
            >
              {item.label}
              {count > 0 ? ` (${count})` : ""}
              {active ? (
                <span className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-fo-accent" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "posts" && (
        <section className="space-y-3" aria-label="Posts">
          {!profile.posts?.length ? (
            <EmptyState>No posts yet.</EmptyState>
          ) : (
            profile.posts.map((post) => (
              <FeedPostRow
                key={post.id}
                post={{ ...post, author }}
                variant="card"
                showCommunity
                showActions={false}
                onOpen={() => navigate(postPath(post))}
              />
            ))
          )}
        </section>
      )}

      {tab === "reposts" && (
        <section className="space-y-3" aria-label="Reposts">
          {!profile.reposts?.length ? (
            <EmptyState>No reposts yet.</EmptyState>
          ) : (
            profile.reposts.map((post) => (
              <div key={`${post.id}-${post.resharedAt}`} className="space-y-1.5">
                <p className="px-1 inline-flex items-center gap-1.5 text-[11px] text-fo-accent">
                  <Repeat2 size={12} aria-hidden />
                  Reposted
                  {post.resharedAt ? ` · ${timeAgo(post.resharedAt)}` : ""}
                </p>
                <FeedPostRow
                  post={{
                    ...post,
                    author: post.originalAuthor || author,
                  }}
                  variant="card"
                  showCommunity
                  showActions={false}
                  onOpen={() => navigate(postPath(post))}
                />
              </div>
            ))
          )}
        </section>
      )}

      {tab === "communities" && (
        <section aria-label="Communities">
          {!profile.communities?.length ? (
            <EmptyState>No communities to show.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {profile.communities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  onClick={() =>
                    navigate(
                      `/communities/${communitySegment(community) || community.id}`
                    )
                  }
                  meta={
                    <span className="capitalize">
                      {community.membershipRole || "member"}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "stores" && (
        <section aria-label="Stores" className="space-y-3">
          {storesLoading ? (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              aria-busy="true"
            >
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-fo-border bg-fo-surface p-3 animate-pulse"
                >
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-fo-surface-hover" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-fo-surface-hover" />
                    <div className="h-3 w-1/2 rounded bg-fo-surface-hover" />
                    <div className="h-3 w-1/3 rounded bg-fo-surface-hover" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Loading stores…</span>
            </div>
          ) : storesError ? (
            <EmptyState>
              <div className="space-y-3">
                <p>{storesError}</p>
                <button
                  type="button"
                  onClick={() => setStoresRetry((retry) => retry + 1)}
                  className="rounded-full border border-fo-border px-3 py-1.5 text-xs font-medium text-fo-muted hover:border-fo-accent/40 hover:text-fo-accent"
                >
                  Retry
                </button>
              </div>
            </EmptyState>
          ) : stores.length === 0 ? (
            <EmptyState>
              <span className="inline-flex items-center gap-2">
                <StoreIcon size={16} aria-hidden />
                No stores found.
              </span>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  to={`/store/${store.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-fo-border bg-fo-surface p-3 transition-colors hover:border-fo-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-fo-bg">
                    {store.logo ? (
                      <img
                        src={displayImageUrl(store.logo, 120)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <StoreIcon
                        size={20}
                        className="text-fo-subtle"
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fo-text">
                      {store.name}
                    </p>
                    <p className="truncate text-[11px] text-fo-subtle">
                      {categoryLabel(store.category)}
                      {formatLocation(store) ? ` · ${formatLocation(store)}` : ""}
                    </p>
                    <p className="text-[11px] text-fo-muted">
                      {store.followerCount || 0} followers
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "followers" && (
        <FollowUserList
          username={profile.username}
          mode="followers"
          forceHidden={Boolean(profile.hideFollowersList)}
        />
      )}

      {tab === "following" && (
        <FollowUserList
          username={profile.username}
          mode="following"
          forceHidden={Boolean(profile.hideFollowingList)}
        />
      )}

      {tab === "about" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4">
            <h2 className="text-[13px] font-semibold text-fo-text">About</h2>
            {profile.bio ? (
              <p className="text-sm text-fo-muted leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-fo-subtle">No bio yet.</p>
            )}

            {profile.interests?.length ? (
              <div className="space-y-2">
                <h3 className="text-[13px] font-semibold text-fo-text">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-fo-accent/10 text-fo-accent text-[11px]"
                    >
                      {String(tag || "").replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-fo-accent" aria-hidden />
              <h2 className="text-[13px] font-semibold text-fo-text">
                Achievements
              </h2>
            </div>
            {!profile.achievements?.length ? (
              <p className="text-xs text-fo-subtle">No badges yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {profile.achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-fo-border bg-fo-bg"
                    title={badge.description}
                  >
                    <span className="w-8 h-8 rounded-lg bg-fo-accent/10 border border-fo-accent/20 flex items-center justify-center shrink-0">
                      <Award size={14} className="text-fo-accent" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-fo-text">
                        {badge.label}
                      </p>
                      <p className="text-xs text-fo-subtle mt-0.5 leading-snug">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <ProfilePhotoViewer
        src={photoOpen ? profile.avatar : ""}
        alt={displayName}
        onClose={() => setPhotoOpen(false)}
      />
    </div>
  );
}