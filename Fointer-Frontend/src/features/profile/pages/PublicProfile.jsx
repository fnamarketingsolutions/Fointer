import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuAward as Award,
  LuFileText as FileText,
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
import { timeAgo } from "../../../shared/utils/date";

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "reposts", label: "Reposts" },
  { id: "communities", label: "Communities" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
  { id: "about", label: "About" },
];

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("posts");
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

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
      navigate(user.role === "admin" ? "/admin/profile" : "/profile", {
        replace: true,
      });
    }
  }, [user, username, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
        <Loader2 size={16} className="animate-spin text-fo-accent" />
        Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs text-fo-subtle hover:text-fo-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          {error || "Profile not found."}
        </div>
      </div>
    );
  }

  const locationParts = [profile.city, profile.state, profile.country].filter(
    Boolean
  );
  const postCount = profile.stats?.posts || profile.posts?.length || 0;
  const communityCount =
    profile.stats?.communitiesJoined || profile.communities?.length || 0;
  const followerCount = profile.stats?.followers ?? 0;
  const followingCount = profile.stats?.following ?? 0;

  const tabItems = TABS.map((item) => {
    if (item.id === "followers") {
      return { ...item, label: `Followers (${followerCount})` };
    }
    if (item.id === "following") {
      return { ...item, label: `Following (${followingCount})` };
    }
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
                nextFollowers !== undefined ? nextFollowers : prev.stats?.followers,
            },
          }
        : prev
    );
  };

  const handleMessage = async () => {
    if (!user) {
      navigate("/login", {
        state: { from: `/users/${username}` },
      });
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
      showToast(err?.response?.data?.message || "Could not start conversation.");
    } finally {
      setMessaging(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs text-fo-subtle hover:text-fo-accent"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="flex items-start gap-4 bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4">
        <ProfileAvatar
          src={profile.avatar}
          alt={profile.name || "Profile"}
          className="w-16 h-16 rounded-full object-cover border border-fo-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-fo-text truncate">
                {profile.name || profile.username}
              </h1>
              <p className="text-xs text-fo-subtle truncate">
                @{normalizeUsername(profile.username)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleMessage}
                disabled={messaging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fo-border text-xs font-medium text-fo-text hover:border-fo-accent/40 disabled:opacity-60"
              >
                {messaging ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MessageCircle size={14} />
                )}
                Message
              </button>
              <FollowButton
                username={profile.username}
                initialFollowing={Boolean(profile.isFollowing)}
                onChange={handleFollowChange}
              />
            </div>
          </div>
          <p className="text-xs text-fo-subtle mt-2">
            {postCount} posts · {communityCount} communities
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {tabItems.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "posts" && (
        <section className="space-y-2.5">
          {!profile.posts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No posts yet.
            </div>
          ) : (
            profile.posts.map((post) => {
              const postSeg = postSegment(post) || post.id;
              const communitySeg = post.community
                ? communitySegment(post.community) || post.community.id
                : null;
              const to = communitySeg
                ? `/communities/${communitySeg}/posts/${postSeg}`
                : `/post/${postSeg}`;
              return (
                <Link
                  key={post.id}
                  to={to}
                  className="group block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-1"
                >
                  <p className="text-sm font-medium text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2">
                    {post.title || "Untitled"}
                  </p>
                  {post.text ? (
                    <p className="text-xs text-fo-subtle line-clamp-2">
                      {post.text}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-fo-subtle">
                    {post.community?.name || "Public"}
                    {post.createdAt ? ` · ${timeAgo(post.createdAt)}` : ""}
                  </p>
                </Link>
              );
            })
          )}
        </section>
      )}

      {tab === "reposts" && (
        <section className="space-y-2.5">
          {!profile.reposts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No reposts yet.
            </div>
          ) : (
            profile.reposts.map((post) => {
              const postSeg = postSegment(post) || post.id;
              const communitySeg = post.community
                ? communitySegment(post.community) || post.community.id
                : null;
              const to = communitySeg
                ? `/communities/${communitySeg}/posts/${postSeg}`
                : `/post/${postSeg}`;
              return (
                <Link
                  key={`${post.id}-${post.resharedAt}`}
                  to={to}
                  className="group block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-1"
                >
                  <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-fo-accent">
                    <Repeat2 size={12} />
                    Reposted
                    {post.resharedAt ? ` · ${timeAgo(post.resharedAt)}` : ""}
                  </p>
                  <p className="text-sm font-medium text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2">
                    {post.title || "Untitled"}
                  </p>
                  {post.originalAuthor ? (
                    <p className="text-[11px] text-fo-subtle">
                      by{" "}
                      <UserProfileLink
                        author={post.originalAuthor}
                        className="hover:text-fo-accent transition-colors"
                        stopPropagation={false}
                      >
                        {post.originalAuthor.name ||
                          post.originalAuthor.username}
                      </UserProfileLink>
                      {post.community?.name
                        ? ` · ${post.community.name}`
                        : ""}
                    </p>
                  ) : null}
                </Link>
              );
            })
          )}
        </section>
      )}

      {tab === "communities" && (
        <section className="space-y-2.5">
          {!profile.communities?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No communities to show.
            </div>
          ) : (
            profile.communities.map((community) => (
              <Link
                key={community.id}
                to={`/communities/${communitySegment(community) || community.id}`}
                className="group flex items-center justify-between gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fo-text group-hover:text-fo-accent transition-colors truncate">
                    {community.name}
                  </p>
                  <p className="text-[11px] text-fo-subtle capitalize mt-0.5">
                    {community.membershipRole || "member"}
                  </p>
                </div>
                <Users size={14} className="text-fo-subtle shrink-0" />
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
                <h2 className="text-[11px] uppercase tracking-wide text-fo-subtle mb-2">
                  Bio
                </h2>
                <p className="text-sm text-fo-muted leading-relaxed">
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

            {profile.interests?.length ? (
              <div className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-wide text-fo-subtle">
                  Interests
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-md border border-fo-border bg-fo-bg text-[11px] text-fo-muted"
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
              <Award size={15} className="text-fo-accent" />
              <h3 className="text-sm font-semibold text-fo-text">
                Achievements
              </h3>
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
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-fo-text">
                        {badge.label}
                      </p>
                      <p className="text-[11px] text-fo-subtle mt-0.5">
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
