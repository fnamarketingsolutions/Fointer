import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuArrowRightLeft as Transfer,
  LuLoaderCircle as Loader2,
  LuTrash2 as Trash2,
} from "react-icons/lu";
import {
  deleteMyAccount,
  fetchDeletionBlockers,
  fetchMyProfile,
} from "../../../api/profile";
import { deleteCommunity } from "../../../api/communities";
import { deleteWatchGroup } from "../../../api/watchGroups";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { communitySegment } from "../../../shared/services/entityLinks";
import { getErrorMessage } from "../../../shared/utils/errors";

const fieldClass =
  "w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50 focus-visible:ring-2 focus-visible:ring-fo-accent/40";

const labelClass =
  "block text-xs uppercase tracking-wide text-fo-subtle mb-1.5";

export default function DeleteMe() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState({
    communities: [],
    watchGroups: [],
  });
  const [busyId, setBusyId] = useState("");

  const blocked =
    blockers.communities.length > 0 || blockers.watchGroups.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, blockerData] = await Promise.all([
        fetchMyProfile(),
        fetchDeletionBlockers(),
      ]);
      setHasPassword(Boolean(profileData?.profile?.hasPassword));
      setBlockers({
        communities: blockerData?.blockers?.communities || [],
        watchGroups: blockerData?.blockers?.watchGroups || [],
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteResource = async (kind, item) => {
    const id = item.id;
    const label = item.name || (kind === "community" ? "community" : "group");
    if (
      !window.confirm(
        `Delete ${label}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(`${kind}:${id}`);
    try {
      if (kind === "community") {
        await deleteCommunity(id);
      } else {
        await deleteWatchGroup(id);
      }
      showToast(`${label} deleted.`);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, `Failed to delete ${label}.`));
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (blocked) return;
    setSaving(true);
    setError("");
    try {
      const payload = hasPassword
        ? { password }
        : { confirmText };
      const data = await deleteMyAccount(payload);
      showToast(data?.message || "Account deleted.");
      try {
        await logout();
      } catch {
        /* cookie already cleared */
      }
      navigate("/", { replace: true });
    } catch (err) {
      const nextBlockers = err?.response?.data?.blockers;
      if (nextBlockers) {
        setBlockers({
          communities: nextBlockers.communities || [],
          watchGroups: nextBlockers.watchGroups || [],
        });
      }
      let message =
        err?.response?.data?.message || "Failed to delete account.";
      setError(message);
      showToast(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5">
      <div className="flex items-center gap-2">
        <Link
          to="/profile?tab=security"
          className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          aria-label="Back to security"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-fo-text flex items-center gap-2">
            <Trash2 size={18} className="text-red-400 shrink-0" aria-hidden />
            Delete account
          </h1>
          <p className="text-xs text-fo-subtle">
            Need help?{" "}
            <Link to="/user-delete" className="text-fo-accent hover:underline">
              Account deletion guide
            </Link>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-fo-subtle py-14 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {blocked ? (
            <section className="bg-fo-surface border border-amber-500/35 rounded-xl p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-fo-text">
                  Resolve ownership first
                </h2>
                <p className="text-xs text-fo-subtle mt-1 leading-relaxed">
                  Transfer ownership to another member, or delete the community /
                  watch group. Account deletion stays locked until this list is
                  empty.
                </p>
              </div>

              {blockers.communities.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-fo-subtle">
                    Communities you own
                  </p>
                  {blockers.communities.map((c) => {
                    const seg = communitySegment(c) || c.id;
                    const busy = busyId === `community:${c.id}`;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-fo-border"
                      >
                        <p className="text-sm font-medium text-fo-text min-w-0 flex-1 truncate">
                          {c.name || "Community"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/communities/manage/${seg}?transfer=1`}
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-fo-accent/40 text-fo-accent text-xs font-semibold"
                          >
                            <Transfer size={13} /> Transfer
                          </Link>
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => handleDeleteResource("community", c)}
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold disabled:opacity-60"
                          >
                            {busy ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {blockers.watchGroups.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-fo-subtle">
                    Watch groups you own
                  </p>
                  {blockers.watchGroups.map((g) => {
                    const seg = g.shortCode || g.id;
                    const busy = busyId === `watch:${g.id}`;
                    return (
                      <div
                        key={g.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-fo-border"
                      >
                        <p className="text-sm font-medium text-fo-text min-w-0 flex-1 truncate">
                          {g.name || "Watch group"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/watch-groups/${seg}?transfer=1`}
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-fo-accent/40 text-fo-accent text-xs font-semibold"
                          >
                            <Transfer size={13} /> Transfer
                          </Link>
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => handleDeleteResource("watch", g)}
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold disabled:opacity-60"
                          >
                            {busy ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <button
                type="button"
                onClick={load}
                className="text-xs text-fo-accent hover:underline"
              >
                Refresh list
              </button>
            </section>
          ) : null}

          <section className="bg-fo-surface border border-red-500/30 rounded-xl p-4 sm:p-5 space-y-4">
            <p className="text-sm text-fo-muted leading-relaxed">
              This permanently deletes your profile, posts, comments, listings, and
              personal data. Messages you sent may stay visible to others as{" "}
              <span className="text-fo-text">Deleted User</span>. This cannot be
              undone.
            </p>

            <form onSubmit={handleDelete} className="space-y-4">
              {hasPassword ? (
                <div>
                  <label htmlFor="delete-me-password" className={labelClass}>
                    Current password
                  </label>
                  <input
                    id="delete-me-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={blocked}
                    autoComplete="current-password"
                    className={`${fieldClass} disabled:opacity-50`}
                    placeholder="Enter your password"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="delete-me-confirm" className={labelClass}>
                    Type DELETE to confirm
                  </label>
                  <input
                    id="delete-me-confirm"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    required
                    disabled={blocked}
                    className={`${fieldClass} disabled:opacity-50`}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
              )}

              {error ? (
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              ) : null}

              {blocked ? (
                <p className="text-xs text-amber-400/90 leading-relaxed">
                  Finish transfer or delete above before you can delete your
                  account.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/profile?tab=security"
                  className="inline-flex items-center justify-center min-h-10 px-4 rounded-lg border border-fo-border text-sm text-fo-muted hover:text-fo-text"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || blocked}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-red-500/50 bg-red-500/15 text-red-400 text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} aria-hidden />
                  )}
                  Delete forever
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
