import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuAward as Award,
  LuChevronRight as ChevronRight,
  LuLoaderCircle as Loader2,
  LuMapPin as MapPin,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuUsers as Users,
} from "react-icons/lu";
import { fetchPublicProfile } from "../../../api/profile";
import { useAuth } from "../../../context/AuthContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import {
  communitySegment,
  postSegment,
} from "../../../shared/services/entityLinks";
import { normalizeUsername } from "../../../shared/services/profileLinks";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import FollowButton from "../../../shared/components/FollowButton";
import FollowUserList from "../components/FollowUserList";
import { createConversation } from "../../../api/messages";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { formatLongDate, timeAgo } from "../../../shared/utils/date";
import { formatCommunityType } from "../../../shared/utils/community";

const TABS = [
  { id: "about", label: "About" },
  { id: "posts", label: "Posts" },
  { id: "reposts", label: "Reposts" },
  { id: "communities", label: "Communities" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const cardClass =
  "bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4";
const tabBtnClass = (active) =>
  `flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
    active
      ? "bg-fo-surface-3 text-fo-accent border border-fo-accent/35"
      : "text-fo-subtle hover:text-fo-text border border-transparent"
  }`;
const listLinkClass =
  "group block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40";

function postPath(post) {
  const postSeg = postSegment(post) || post.id;
  const communitySeg = post.community
    ? communitySegment(post.community) || post.community.id
    : null;
  return communitySeg
    ? `/communities/${communitySeg}/posts/${postSeg}`
    : `/post/${postSeg}`;
}

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("about");
  const [messaging, setMessaging] = useState(false);

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
    setLoading(true);
    setError("");
    setTab("about");

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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    const clean = normalizeUsername(username);
    const me = normalizeUsername(user?.username);
    if (user && clean && me === clean) {
      navigate("/profile", { replace: true });
    }
  }, [user, username, navigate]);

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-5" aria-busy="true">
        <div className="h-10 w-24 rounded-lg bg-fo-surface-hover animate-pulse" />
        <div className={`${cardClass} animate-pulse space-y-3`}>
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-fo-surface-hover shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 w-40 rounded bg-fo-surface-hover" />
              <div className="h-3 w-28 rounded bg-fo-surface-hover" />
              <div className="h-3 w-48 rounded bg-fo-surface-hover" />
            </div>
          </div>
        </div>
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 min-h-10 px-1 text-sm text-fo-subtle hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
        >
          <ArrowLeft size={16} />
          Back
        </button>
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
              className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const locationParts = [profile.city, profile.state, profile.country].filter(
    Boolean
  );
  const postCount = profile.stats?.posts || profile.posts?.length || 0;
  const repostCount = profile.stats?.reposts || profile.reposts?.length || 0;
  const communityCount =
    profile.stats?.communitiesJoined || profile.communities?.length || 0;
  const followerCount = profile.stats?.followers ?? 0;
  const followingCount = profile.stats?.following ?? 0;
  const handle = normalizeUsername(profile.username);
  const profilePath = `/users/${handle || username}`;

  const tabItems = TABS.map((item) => {
    if (item.id === "posts") return { ...item, label: `Posts (${postCount})` };
    if (item.id === "reposts")
      return { ...item, label: `Reposts (${repostCount})` };
    if (item.id === "communities")
      return { ...item, label: `Communities (${communityCount})` };
    if (item.id === "followers")
      return { ...item, label: `Followers (${followerCount})` };
    if (item.id === "following")
      return { ...item, label: `Following (${followingCount})` };
    return item;
  });

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

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 min-h-10 px-1 text-sm text-fo-subtle hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProfileAvatar
            src={profile.avatar}
            alt={profile.name || "Profile"}
            name={profile.name || profile.username}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-fo-border shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-fo-text truncate">
                  {profile.name || profile.username}
                </h1>
                <p className="text-sm text-fo-muted truncate">@{handle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleMessage}
                  disabled={messaging}
                  className="inline-flex items-center gap-1.5 min-h-10 px-3 py-2 rounded-lg border border-fo-border text-xs font-medium text-fo-text hover:border-fo-accent/40 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
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
                    onChange={handleFollowChange}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={requireAuthForFollow}
                    className="inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-fo-accent text-black hover:bg-fo-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                  >
                    Follow
                  </button>
                )}
              </div>
            </div>

            {profile.bio ? (
              <p className="text-sm text-fo-muted leading-relaxed line-clamp-3">
                {profile.bio}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fo-subtle">
              {locationParts.length ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-fo-accent shrink-0" />
                  {locationParts.join(", ")}
                </span>
              ) : null}
              {profile.createdAt ? (
                <span>Joined {formatLongDate(profile.createdAt)}</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fo-muted">
              <button
                type="button"
                onClick={() => setTab("posts")}
                className="hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
              >
                <span className="font-semibold text-fo-text tabular-nums">
                  {postCount}
                </span>{" "}
                posts
              </button>
              <button
                type="button"
                onClick={() => setTab("communities")}
                className="hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
              >
                <span className="font-semibold text-fo-text tabular-nums">
                  {communityCount}
                </span>{" "}
                communities
              </button>
              <button
                type="button"
                onClick={() => setTab("followers")}
                className="hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
              >
                <span className="font-semibold text-fo-text tabular-nums">
                  {followerCount}
                </span>{" "}
                followers
              </button>
              <button
                type="button"
                onClick={() => setTab("following")}
                className="hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
              >
                <span className="font-semibold text-fo-text tabular-nums">
                  {followingCount}
                </span>{" "}
                following
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto"
        role="tablist"
        aria-label="Profile sections"
      >
        {tabItems.map((item) => {
          const active = tab === item.id;
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
            </button>
          );
        })}
      </div>

      {tab === "posts" && (
        <section className="space-y-2.5" aria-label="Posts">
          {!profile.posts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No posts yet.
            </div>
          ) : (
            profile.posts.map((post) => (
              <Link
                key={post.id}
                to={postPath(post)}
                className={`${listLinkClass} space-y-1`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2 min-w-0">
                    {post.title || "Untitled"}
                  </p>
                  <ChevronRight
                    size={16}
                    className="text-fo-subtle shrink-0 mt-0.5"
                    aria-hidden
                  />
                </div>
                {post.text ? (
                  <p className="text-xs text-fo-subtle line-clamp-2">
                    {post.text}
                  </p>
                ) : null}
                <p className="text-xs text-fo-subtle">
                  {post.community?.name || "Public"}
                  {post.createdAt ? ` · ${timeAgo(post.createdAt)}` : ""}
                </p>
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "reposts" && (
        <section className="space-y-2.5" aria-label="Reposts">
          {!profile.reposts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No reposts yet.
            </div>
          ) : (
            profile.reposts.map((post) => (
              <Link
                key={`${post.id}-${post.resharedAt}`}
                to={postPath(post)}
                className={`${listLinkClass} space-y-1`}
              >
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-fo-accent">
                  <Repeat2 size={12} aria-hidden />
                  Reposted
                  {post.resharedAt ? ` · ${timeAgo(post.resharedAt)}` : ""}
                </p>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2 min-w-0">
                    {post.title || "Untitled"}
                  </p>
                  <ChevronRight
                    size={16}
                    className="text-fo-subtle shrink-0 mt-0.5"
                    aria-hidden
                  />
                </div>
                {post.originalAuthor ? (
                  <p className="text-xs text-fo-subtle">
                    by{" "}
                    <UserProfileLink
                      author={post.originalAuthor}
                      className="hover:text-fo-accent transition-colors"
                      stopPropagation={false}
                    >
                      {post.originalAuthor.name ||
                        post.originalAuthor.username}
                    </UserProfileLink>
                    {post.community?.name ? ` · ${post.community.name}` : ""}
                  </p>
                ) : null}
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "communities" && (
        <section className="space-y-2.5" aria-label="Communities">
          {!profile.communities?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No communities to show.
            </div>
          ) : (
            profile.communities.map((community) => (
              <Link
                key={community.id}
                to={`/communities/${communitySegment(community) || community.id}`}
                className={`${listLinkClass} flex items-center gap-3`}
              >
                {community.coverImage ? (
                  <img
                    src={community.coverImage}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-fo-border shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-fo-surface-3 border border-fo-border flex items-center justify-center shrink-0">
                    <Users size={16} className="text-fo-accent/70" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors truncate">
                    {community.name}
                  </p>
                  <p className="text-xs text-fo-subtle mt-0.5">
                    {formatCommunityType(community.type)}
                    <span className="mx-1">·</span>
                    <span className="capitalize">
                      {community.membershipRole || "member"}
                    </span>
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="text-fo-subtle shrink-0"
                  aria-hidden
                />
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "followers" && (
        <FollowUserList username={profile.username} mode="followers" />
      )}

      {tab === "following" && (
        <FollowUserList username={profile.username} mode="following" />
      )}

      {tab === "about" && (
        <div className="space-y-4">
          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4">
            {profile.bio ? (
              <div>
                <h2 className="text-xs uppercase tracking-wide text-fo-subtle mb-2">
                  Bio
                </h2>
                <p className="text-sm text-fo-muted leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            ) : null}

            {locationParts.length ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-fo-subtle">
                <MapPin size={13} className="text-fo-accent shrink-0" />
                {locationParts.join(", ")}
              </p>
            ) : null}

            {profile.createdAt ? (
              <p className="text-xs text-fo-subtle">
                Joined {formatLongDate(profile.createdAt)}
              </p>
            ) : null}

            {profile.interests?.length ? (
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wide text-fo-subtle">
                  Interests
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-md border border-fo-border bg-fo-bg text-xs text-fo-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {!profile.bio &&
            !locationParts.length &&
            !profile.interests?.length ? (
              <p className="text-sm text-fo-subtle">No about info yet.</p>
            ) : null}
          </section>

          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-fo-accent" aria-hidden />
              <h2 className="text-sm font-semibold text-fo-text">
                Achievements
              </h2>
            </div>
            {!profile.achievements?.length ? (
              <p className="text-xs text-fo-subtle">No badges yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-fo-border bg-fo-bg"
                    title={badge.description}
                  >
                    <Award
                      size={14}
                      className="text-fo-accent mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-fo-text">
                        {badge.label}
                      </p>
                      <p className="text-xs text-fo-subtle mt-0.5">
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
    </div>
  );
}
