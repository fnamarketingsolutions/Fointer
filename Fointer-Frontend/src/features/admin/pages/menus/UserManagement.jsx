import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBan as Ban,
  LuBuilding2 as Building2,
  LuCircleCheck as CheckCircle2,
  LuChevronDown as ChevronDown,
  LuChevronUp as ChevronUp,
  LuExternalLink as ExternalLink,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuUsers as Users
} from "react-icons/lu";
import {
  fetchAdminUserDetail,
  fetchUsers,
  updateUserStatus,
} from "../../../../api/dashboard";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { communitySegment } from "../../../../shared/services/entityLinks";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "banned", label: "Banned" },
  { id: "users", label: "Users" },
  { id: "moderators", label: "Moderators" },
];

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const statusMeta = (status) => {
  if (status === "banned") {
    return { label: "Banned", className: "text-red-400" };
  }
  if (status === "suspended") {
    return { label: "Suspended", className: "text-amber-400" };
  }
  return { label: "Active", className: "text-emerald-400" };
};

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/30",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
    success:
      "border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

const UserManagement = () => {
  const { user: currentUser } = useAuth();
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [detailByUserId, setDetailByUserId] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [expandedCommunityId, setExpandedCommunityId] = useState(null);

  const loadUsers = useCallback(
    async (opts = {}) => {
      const nextFilter = opts.filter ?? filter;
      const nextSearch = opts.search ?? search;
      setLoading(true);
      try {
        const params = {};
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
        setMatchedCount(data?.pagination?.total ?? data?.users?.length ?? 0);
      } catch (err) {
        showToast(err?.response?.data?.message || "Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [filter, search, showToast]
  );

  useEffect(() => {
    loadUsers({ filter });
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
    setBusyId(u.id);
    try {
      await updateUserStatus(u.id, status);
      await loadUsers();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleUserDetail = async (u) => {
    if (expandedUserId === u.id) {
      setExpandedUserId(null);
      setExpandedCommunityId(null);
      return;
    }

    setExpandedUserId(u.id);
    setExpandedCommunityId(null);

    if (detailByUserId[u.id]) return;

    setDetailLoadingId(u.id);
    try {
      const data = await fetchAdminUserDetail(u.id);
      setDetailByUserId((prev) => ({ ...prev, [u.id]: data }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load user detail.");
    } finally {
      setDetailLoadingId(null);
    }
  };

  const toggleCommunityMembers = (communityId) => {
    setExpandedCommunityId((prev) =>
      prev === communityId ? null : communityId
    );
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers({ search });
  };

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
              : `Showing ${matchedCount} of ${summary[filter] ?? summary.all} users`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadUsers()}
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
          {users.map((u, index) => {
            const isSelf =
              String(u.id) === String(currentUser?.id || currentUser?._id);
            const busy = busyId === u.id;
            const detail = detailByUserId[u.id];
            const detailLoading = detailLoadingId === u.id;
            const expanded = expandedUserId === u.id;
            const status = statusMeta(u.status);

            return (
              <article
                key={u.id}
                className={`bg-fo-surface border rounded-xl overflow-hidden transition-colors ${
                  expanded
                    ? "border-fo-accent/40"
                    : "border-fo-border hover:border-fo-accent/35"
                }`}
              >
                <div className="flex gap-3 p-3.5 sm:p-4 items-center">
                  <span className="w-6 shrink-0 text-center text-[11px] font-medium text-fo-subtle">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleUserDetail(u)}
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
                      </div>
                      <p className="text-[11px] text-fo-subtle truncate">
                        {u.name || "No display name"}
                        {u.email ? ` · ${u.email}` : ""}
                      </p>
                    </div>
                    <span className="text-fo-subtle shrink-0 hidden sm:block">
                      {expanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.status !== "banned" ? (
                      <ActionBtn
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
                      </ActionBtn>
                    ) : null}
                    {u.status !== "active" ? (
                      <ActionBtn
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
                      </ActionBtn>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-fo-border px-3.5 sm:px-4 py-4 space-y-4 bg-fo-bg/50">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-xs text-fo-subtle py-2">
                        <Loader2 size={12} className="animate-spin" />
                        Loading user detail…
                      </div>
                    ) : detail?.user ? (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fo-subtle">
                          <span>
                            Name:{" "}
                            <span className="text-fo-muted">
                              {detail.user.name || "—"}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            @{detail.user.username}
                          </span>
                          <span>·</span>
                          <span>
                            {detail.communityCount || 0} communities owned
                          </span>
                        </div>

                        <section className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-fo-accent" />
                            <h3 className="text-sm font-semibold text-fo-text">
                              Owned communities
                            </h3>
                          </div>

                          {!detail.ownedCommunities?.length ? (
                            <p className="text-xs text-fo-subtle">
                              This user does not own any communities.
                            </p>
                          ) : (
                            detail.ownedCommunities.map((community) => {
                              const membersOpen =
                                expandedCommunityId === community.id;
                              return (
                                <div
                                  key={community.id}
                                  className="border border-fo-border rounded-xl bg-fo-surface overflow-hidden"
                                >
                                  <div className="flex items-center gap-3 p-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleCommunityMembers(community.id)
                                      }
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <p className="text-sm font-medium text-fo-text truncate">
                                        {community.name}
                                      </p>
                                      <p className="text-[11px] text-fo-subtle mt-0.5">
                                        {TYPE_LABELS[community.type] ||
                                          community.type}{" "}
                                        · {community.memberCount || 0} members
                                      </p>
                                    </button>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <ActionBtn
                                        onClick={() =>
                                          navigate(
                                            `/admin/communities/${communitySegment(community)}`
                                          )
                                        }
                                      >
                                        <ExternalLink size={12} />
                                        Open
                                      </ActionBtn>
                                      <ActionBtn
                                        onClick={() =>
                                          toggleCommunityMembers(community.id)
                                        }
                                      >
                                        <Users size={12} />
                                        {membersOpen ? (
                                          <ChevronUp size={12} />
                                        ) : (
                                          <ChevronDown size={12} />
                                        )}
                                      </ActionBtn>
                                    </div>
                                  </div>

                                  {membersOpen ? (
                                    <div className="border-t border-fo-border px-3 py-3 space-y-2 bg-fo-bg/40">
                                      {community.members?.length ? (
                                        community.members.map((member) => (
                                          <div
                                            key={member.id}
                                            className="flex items-center justify-between gap-3 text-xs"
                                          >
                                            <div className="min-w-0">
                                              <p className="text-fo-text truncate">
                                                {member.user?.name ||
                                                  "Unnamed member"}
                                              </p>
                                              <p className="text-[11px] text-fo-subtle truncate">
                                                @
                                                {member.user?.username ||
                                                  "unknown"}
                                              </p>
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wide text-fo-subtle shrink-0">
                                              {member.role}
                                            </span>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-xs text-fo-subtle">
                                          No active members found.
                                        </p>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </section>
                      </>
                    ) : (
                      <p className="text-xs text-fo-subtle">
                        No detail available.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
