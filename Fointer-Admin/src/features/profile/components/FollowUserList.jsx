import { useEffect, useState } from "react";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { fetchFollowers, fetchFollowing } from "../../../api/follow";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import { normalizeUsername } from "../../../shared/services/profileLinks";

export default function FollowUserList({ username, mode }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const load =
      mode === "followers"
        ? fetchFollowers(username)
        : fetchFollowing(username);

    load
      .then((data) => {
        if (cancelled) return;
        setUsers(data?.users || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setUsers([]);
        setError(err?.response?.data?.message || "Could not load users.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, mode]);

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

  if (!users.length) {
    return (
      <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
        {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
      </div>
    );
  }

  return (
    <section className="space-y-2.5">
      {users.map((item) => (
        <UserProfileLink
          key={item.id}
          author={item}
          className="flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
          stopPropagation={false}
        >
          <ProfileAvatar
            src={item.avatar}
            name={item.name}
            className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
          />
          <div className="min-w-0 text-left">
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
      ))}
    </section>
  );
}
