import { useState } from "react";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { followUser, unfollowUser } from "../../api/follow";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../components/feedback/ToastContext";

export default function FollowButton({
  username,
  initialFollowing = false,
  onChange,
  className = "",
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      const data = following
        ? await unfollowUser(username)
        : await followUser(username);
      const next = Boolean(data?.following);
      setFollowing(next);
      onChange?.({
        following: next,
        followerCount: data?.followerCount,
        followingCount: data?.followingCount,
      });
      showToast(data?.message || (next ? "Following." : "Unfollowed."));
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not update follow.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ||
        `inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors ${
          following
            ? "border border-fo-border text-fo-text hover:border-red-500/40 hover:text-red-400"
            : "bg-fo-accent text-black hover:bg-fo-accent-hover"
        }`
      }
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {following ? "Following" : "Follow"}
    </button>
  );
}
