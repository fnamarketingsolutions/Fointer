import { useEffect, useState } from "react";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { fetchFollowers, fetchFollowing } from "../../../api/follow";
import { useAuth } from "../../../context/AuthContext";
import FollowButton from "../../../shared/components/FollowButton";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import { normalizeUsername } from "../../../shared/services/profileLinks";

const followBtnClass = (following) =>
  `inline-flex items-center justify-center gap-1.5 min-h-8 px-3 rounded-full text-[12px] font-semibold shrink-0 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
    following
      ? "border border-fo-border text-fo-text hover:border-red-500/40 hover:text-red-500"
      : "bg-fo-accent text-black hover:bg-fo-accent-hover"
  }`;

export default function FollowUserList({ username, mode, forceHidden = false }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(forceHidden);

  useEffect(() => {
    if (forceHidden) {
      setUsers([]);
      setHidden(true);
      setError("");
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setHidden(false);

    const load =
      mode === "followers"
        ? fetchFollowers(username)
        : fetchFollowing(username);

    load
      .then((data) => {
        if (cancelled) return;
        setUsers(data?.users || []);
        setHidden(Boolean(data?.hidden));
      })
      .catch((err) => {
        if (cancelled) return;
        setUsers([]);
        setHidden(false);
        setError(err?.response?.data?.message || "Could not load users.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, mode, forceHidden]);

  const handleFollowChange = (itemId, { following }) => {
    setUsers((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isFollowing: following } : item
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
        <Loader2 size={16} className="animate-spin text-fo-accent" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
        {error}
      </div>
    );
  }

  if (hidden) {
    return (
      <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4">
        {mode === "followers"
          ? "This user has hidden their followers list."
          : "This user has hidden their following list."}
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
        {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
      </div>
    );
  }

  const myId = user?.id || user?._id;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {users.map((item) => {
        const isSelf =
          myId &&
          (String(item.id) === String(myId) ||
            normalizeUsername(item.username) ===
              normalizeUsername(user?.username));
        const showFollow = Boolean(user) && !isSelf;

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-fo-surface border border-fo-border rounded-xl p-3.5"
          >
            <UserProfileLink
              author={item}
              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity"
              stopPropagation={false}
            >
              <ProfileAvatar
                src={item.avatar}
                name={item.name}
                className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
              />
              <div className="min-w-0 text-left flex-1">
                <p className="text-sm font-medium text-fo-text truncate">
                  {item.name || item.username}
                </p>
                <p className="text-[11px] text-fo-subtle truncate">
                  @{normalizeUsername(item.username)}
                </p>
                {item.bio ? (
                  <p className="text-xs text-fo-muted line-clamp-2 mt-1">
                    {item.bio}
                  </p>
                ) : null}
              </div>
            </UserProfileLink>

            {showFollow ? (
              <FollowButton
                username={item.username}
                initialFollowing={Boolean(item.isFollowing)}
                initialFollowedBy={Boolean(item.isFollowedBy)}
                onChange={(payload) => handleFollowChange(item.id, payload)}
                className={followBtnClass(Boolean(item.isFollowing))}
              />
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
