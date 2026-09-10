import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchUsers,
  updateUserStatus,
  createAdminWarning,
  fetchWarningPolicy,
} from "../../../../api/dashboard";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import AdminActionBtn from "../../../../shared/components/AdminActionBtn";
import WarnUserModal from "../../../../shared/components/modals/WarnUserModal";
import { isSuperAdminUser } from "../../../../shared/lib/roles";
import {
  LuBan as Ban,
  LuCircleCheck as CheckCircle2,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuTriangleAlert as AlertTriangle,
} from "react-icons/lu";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "banned", label: "Banned" },
  { id: "users", label: "Users" },
  { id: "moderators", label: "Moderators" },
];

const PAGE_SIZE = 25;

const statusMeta = (status) => {
  if (status === "banned") {
    return { label: "Banned", className: "text-red-400" };
  }
  if (status === "suspended") {
    return { label: "Suspended", className: "text-amber-400" };
  }
  return { label: "Active", className: "text-emerald-400" };
};

const UserManagement = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({
    all: 0,
    active: 0,
    banned: 0,
    users: 0,
    moderators: 0,
  });
  const [matchedCount, setMatchedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnPolicy, setWarnPolicy] = useState({
    maxWarningsBeforeBan: 3,
    autoBanOnMaxWarnings: true,
  });

  useEffect(() => {
    fetchWarningPolicy()
      .then((data) => {
        if (!data?.policy) return;
        setWarnPolicy({
          maxWarningsBeforeBan: data.policy.maxWarningsBeforeBan ?? 3,
          autoBanOnMaxWarnings: data.policy.autoBanOnMaxWarnings !== false,
        });
      })
      .catch(() => {});
  }, []);

  const loadUsers = useCallback(
    async (opts = {}) => {
      const nextFilter = opts.filter ?? filter;
      const nextSearch = opts.search ?? search;
      const nextPage = opts.page ?? page;
      setLoading(true);
      try {
        const params = {
          page: nextPage,
          limit: PAGE_SIZE,
        };
        if (nextSearch.trim()) params.q = nextSearch.trim();
        if (nextFilter === "active" || nextFilter === "banned") {
          params.status = nextFilter;
        } else if (nextFilter === "users") {
          params.role = "user";
        } else if (nextFilter === "moderators") {
          params.moderators = "true";
        }
        const data = await fetchUsers(params);
        setUsers(data?.users || []);
        setSummary(
          data?.summary || {
            all: 0,
            active: 0,
            banned: 0,
            users: 0,
            moderators: 0,
          }
        );
        const total = data?.pagination?.total ?? data?.users?.length ?? 0;
        const pages = Math.max(
          1,
          data?.pagination?.totalPages ??
            Math.ceil(total / PAGE_SIZE) ??
            1
        );
        setMatchedCount(total);
        setTotalPages(pages);
        setPage(data?.pagination?.page ?? nextPage);
      } catch (err) {
        showToast(err?.response?.data?.message || "Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [filter, search, page, showToast]
  );

  useEffect(() => {
    setPage(1);
    loadUsers({ filter, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter chips change
  }, [filter]);

  const setStatus = async (u, status) => {
    if (
      String(u.id) === String(currentUser?.id || currentUser?._id) &&
      status !== "active"
    ) {
      showToast("You cannot ban your own account.");
      return;
    }
    const targetIsAdmin =
      String(u.role || "")
        .toLowerCase()
        .trim() === "admin";
    if (targetIsAdmin && !(isSuperAdmin || isSuperAdminUser(currentUser))) {
      showToast("Only a super admin can change another admin's status.");
      return;
    }
    setBusyId(u.id);
    try {
      await updateUserStatus(u.id, status);
      await loadUsers({ page });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const openUserProfile = (u) => {
    const userId = u?.id ? String(u.id) : "";
    if (!userId) {
      showToast("User id missing.");
      return;
    }
    navigate(`/users/${userId}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers({ search, page: 1 });
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || loading) {
      return;
    }
    setPage(nextPage);
    loadUsers({ page: nextPage });
  };

  const submitWarn = async (message) => {
    if (!warnTarget?.id) return;
    setWarnSaving(true);
    try {
      const data = await createAdminWarning({
        userId: warnTarget.id,
        message,
        source: "admin_panel",
      });
      showToast(data?.message || "Warning issued.");
      setWarnTarget(null);
      await loadUsers({ page });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to issue warning.");
    } finally {
      setWarnSaving(false);
    }
  };

  const rangeStart =
    matchedCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, matchedCount);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Users ({summary.all})
          </h1>
          <p className="text-sm text-fo-subtle">
            {search.trim()
              ? `${matchedCount} result${matchedCount === 1 ? "" : "s"} for this search`
              : matchedCount === 0
                ? "No users in this filter"
                : `Showing ${rangeStart}–${rangeEnd} of ${matchedCount}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadUsers({ page })}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {f.label}
              {summary[f.id] != null ? ` (${summary[f.id]})` : ""}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by name, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No users match this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {users.map((u) => {
            const isSelf =
              String(u.id) === String(currentUser?.id || currentUser?._id);
            const busy = busyId === u.id;
            const status = statusMeta(u.status);
            const targetIsAdmin =
              String(u.role || "")
                .toLowerCase()
                .trim() === "admin";
            const canModerateStatus =
              !targetIsAdmin ||
              Boolean(isSuperAdmin || isSuperAdminUser(currentUser));

            return (
              <article
                key={u.id}
                className="bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl overflow-hidden transition-colors"
              >
                <div className="flex gap-3 p-3.5 sm:p-4 items-center">
                  <button
                    type="button"
                    onClick={() => openUserProfile(u)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent text-sm font-semibold shrink-0">
                        {(u.name || u.username || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-fo-text truncate">
                          {u.username || "unknown"}
                        </h2>
                        <span className="text-[10px] uppercase tracking-wide text-fo-subtle">
                          {u.role}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                        {(u.warningCount || 0) > 0 ? (
                          <span className="text-[10px] font-medium text-amber-300">
                            {u.warningCount} warn
                            {u.warningCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-fo-subtle truncate">
                        {u.name || "No display name"}
                        {u.email ? ` · ${u.email}` : ""}
                      </p>
                    </div> 
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canModerateStatus && u.status !== "banned" ? (
                      <AdminActionBtn
                        disabled={busy || isSelf}
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarnTarget(u);
                        }}
                      >
                        <AlertTriangle size={12} />
                        Warn
                      </AdminActionBtn>
                    ) : null}
                    {canModerateStatus && u.status !== "banned" ? (
                      <AdminActionBtn
                        tone="danger"
                        disabled={busy || isSelf}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(u, "banned");
                        }}
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Ban size={12} />
                        )}
                        Ban
                      </AdminActionBtn>
                    ) : null}
                    {canModerateStatus && u.status !== "active" ? (
                      <AdminActionBtn
                        tone="success"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(u, "active");
                        }}
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        Activate
                      </AdminActionBtn>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && matchedCount > 0 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-fo-subtle">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={loading || page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 disabled:opacity-50"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <WarnUserModal
        open={Boolean(warnTarget)}
        user={warnTarget}
        warningCount={warnTarget?.warningCount || 0}
        maxWarningsBeforeBan={warnPolicy.maxWarningsBeforeBan}
        autoBanOnMaxWarnings={warnPolicy.autoBanOnMaxWarnings}
        loading={warnSaving}
        onClose={() => !warnSaving && setWarnTarget(null)}
        onSubmit={submitWarn}
      />
    </div>
  );
};

export default UserManagement;
