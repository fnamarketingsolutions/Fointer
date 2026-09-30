import { useCallback, useEffect, useState } from "react";
import {
  LuCheck as Check,
  LuCopy as Copy,
  LuLoaderCircle as Loader2,
  LuShare2 as Share2,
  LuUsers as Users,
} from "react-icons/lu";
import { fetchMyReferrals } from "../../../api/referrals";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { normalizeUsername } from "../../../shared/services/profileLinks";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { Link } from "react-router-dom";
import { timeAgo } from "../../../shared/utils/date";

export default function InviteFriendsCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchMyReferrals({ limit: 8 });
      if (res?.success) {
        setData(res);
      } else {
        setError(res?.message || "Unable to load invite link.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load invite link.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inviteLink = data?.inviteLink || "";
  const code = data?.code || "";
  const qualified = data?.stats?.qualified ?? 0;
  const pending = data?.stats?.pending ?? 0;

  const copyLink = async () => {
    if (!inviteLink) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast("Invite link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy. Select the link and copy manually.");
    } finally {
      setCopying(false);
    }
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Fointer",
          text: "Sign up on Fointer with my invite link:",
          url: inviteLink,
        });
        return;
      } catch {
        /* user cancelled or unsupported — fall through */
      }
    }
    await copyLink();
  };

  return (
    <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Share2 size={15} className="text-fo-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fo-text">Invite friends</h3>
            <p className="text-xs text-fo-subtle mt-0.5">
              Share your link. Friends who verify email count toward your Inviter
              badge.
            </p>
          </div>
        </div>
        {!loading && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-fo-text tabular-nums">
              {qualified}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-fo-subtle">
              joined
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-fo-subtle py-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading invite link…
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-xs text-fo-subtle">{error}</p>
          <button
            type="button"
            onClick={load}
            className="text-xs font-semibold text-fo-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-fo-border bg-fo-bg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-fo-subtle mb-0.5">
                Your code · {code}
              </p>
              <p className="text-xs text-fo-text truncate" title={inviteLink}>
                {inviteLink}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={copyLink}
                disabled={copying || !inviteLink}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={shareLink}
                disabled={!inviteLink}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          </div>

          {(qualified > 0 || pending > 0) && (
            <p className="text-xs text-fo-subtle flex items-center gap-1.5">
              <Users size={12} aria-hidden />
              {qualified} verified
              {pending > 0 ? ` · ${pending} pending verification` : ""}
            </p>
          )}

          {data?.referrals?.length > 0 && (
            <ul className="space-y-2 border-t border-fo-border pt-3">
              {data.referrals.map((row) => {
                const handle = normalizeUsername(row.referee?.username);
                const label =
                  row.referee?.name ||
                  row.referee?.username ||
                  "Deleted user";
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <ProfileAvatar
                      src={row.referee?.avatar}
                      name={label}
                      className="w-8 h-8 rounded-full object-cover border border-fo-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      {handle ? (
                        <Link
                          to={`/users/${handle}`}
                          className="text-xs font-semibold text-fo-text hover:text-fo-accent truncate block"
                        >
                          {label}
                        </Link>
                      ) : (
                        <p className="text-xs font-semibold text-fo-text truncate">
                          {label}
                        </p>
                      )}
                      <p className="text-[11px] text-fo-subtle">
                        {row.status === "qualified" ? "Joined" : "Pending"}
                        {row.createdAt ? ` · ${timeAgo(row.createdAt)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                        row.status === "qualified"
                          ? "text-fo-accent"
                          : "text-fo-subtle"
                      }`}
                    >
                      {row.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
