import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import { fetchAdminReferrals } from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "qualified", label: "Qualified" },
  { id: "pending", label: "Pending" },
];

const formatWhen = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
};

const personLabel = (person) => {
  if (!person) return "Deleted user";
  return person.name || person.username || person.email || "User";
};

export default function ReferralManagement() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, qualified: 0 });
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async ({ cursor, append } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const result = await fetchAdminReferrals({
          status: status === "all" ? undefined : status,
          q: q || undefined,
          limit: 30,
          cursor: cursor || undefined,
        });
        setStats(result.stats || { total: 0, pending: 0, qualified: 0 });
        setNextCursor(result.nextCursor || null);
        setRows((prev) =>
          append ? [...prev, ...(result.referrals || [])] : result.referrals || []
        );
        setError("");
      } catch (err) {
        const message = getErrorMessage(err, "Failed to load referrals.");
        setError(message);
        if (!append) showToast(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, q, showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const submitSearch = (event) => {
    event.preventDefault();
    setQ(searchInput.trim());
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 text-fo-text">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <UserPlus size={20} className="text-fo-accent" /> Referrals
          </h1>
          <p className="mt-1 text-sm text-fo-subtle">
            Attribution history for invite links and codes. Qualified = email verified.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total attributions", value: stats.total },
          { label: "Qualified", value: stats.qualified },
          { label: "Pending verify", value: stats.pending },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-fo-border bg-fo-surface p-4"
          >
            <p className="text-xl font-semibold">{metric.value}</p>
            <p className="text-xs text-fo-subtle">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap gap-1 border-b border-fo-border pb-1"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((item) => {
            const active = status === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "text-fo-accent" : "text-fo-subtle hover:text-fo-text"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submitSearch} className="flex gap-2 w-full sm:w-auto">
          <label className="relative flex-1 sm:w-72">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, username, code…"
              className="w-full rounded-xl border border-fo-border bg-fo-bg py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-fo-accent px-3 py-2 text-xs font-semibold text-black"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-fo-accent">
          <Loader2 className="animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-fo-border p-6 text-center space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="text-sm text-fo-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-fo-border py-14 text-center text-sm text-fo-subtle">
          No referrals match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-fo-border bg-fo-surface">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="text-fo-subtle border-b border-fo-border">
              <tr>
                <th className="p-3 font-medium">Referrer</th>
                <th className="p-3 font-medium">Referee</th>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Qualified</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-fo-border/80">
                  <td className="p-3 align-top">
                    {row.referrer?.id ? (
                      <Link
                        to={`/users/${row.referrer.id}`}
                        className="font-medium text-fo-text hover:text-fo-accent"
                      >
                        {personLabel(row.referrer)}
                      </Link>
                    ) : (
                      <span className="text-fo-subtle">{personLabel(row.referrer)}</span>
                    )}
                    <p className="text-[11px] text-fo-subtle mt-0.5">
                      {row.referrer?.username
                        ? `@${row.referrer.username}`
                        : row.referrer?.email || "—"}
                      {row.referrer?.referralCode
                        ? ` · code ${row.referrer.referralCode}`
                        : ""}
                    </p>
                  </td>
                  <td className="p-3 align-top">
                    {row.referee?.id ? (
                      <Link
                        to={`/users/${row.referee.id}`}
                        className="font-medium text-fo-text hover:text-fo-accent"
                      >
                        {personLabel(row.referee)}
                      </Link>
                    ) : (
                      <span className="text-fo-subtle">{personLabel(row.referee)}</span>
                    )}
                    <p className="text-[11px] text-fo-subtle mt-0.5">
                      {row.referee?.username
                        ? `@${row.referee.username}`
                        : row.referee?.email || "—"}
                    </p>
                  </td>
                  <td className="p-3 align-top font-mono text-[11px]">
                    {row.codeUsed || "—"}
                  </td>
                  <td className="p-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.status === "qualified"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/25"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 align-top text-fo-subtle">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="p-3 align-top text-fo-subtle">
                    {formatWhen(row.qualifiedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => load({ cursor: nextCursor, append: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-fo-border px-4 py-2 text-xs font-semibold text-fo-muted hover:text-fo-accent disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
