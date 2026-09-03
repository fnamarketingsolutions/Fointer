import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuArrowRight as ArrowRight,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuUsers as Users
} from "react-icons/lu";
import {
  deleteCommunity,
  fetchAllCommunities,
} from "../../../../api/communities";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { communitySegment } from "../../../../shared/services/entityLinks";

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "public", label: "Public" },
  { id: "private_invite", label: "Invite" },
  { id: "private_request", label: "Request" },
];

function CommunityThumb({ community }) {
  const name = community?.name || "Community";
  if (community?.coverImage) {
    return (
      <img
        src={community.coverImage}
        alt={name}
        className="w-12 h-12 rounded-lg object-cover border border-fo-border shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg bg-[#1A1510] border border-fo-border flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-fo-accent/60">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export default function CommunityManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [communityToDelete, setCommunityToDelete] = useState(null);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllCommunities();
      setCommunities(data?.communities || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load communities.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const summary = useMemo(() => {
    const counts = {
      all: communities.length,
      public: 0,
      private_invite: 0,
      private_request: 0,
    };
    for (const community of communities) {
      if (community.type && counts[community.type] != null) {
        counts[community.type] += 1;
      }
    }
    return counts;
  }, [communities]);

  const filteredCommunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communities.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!q) return true;
      return (c.name || "").toLowerCase().includes(q);
    });
  }, [communities, search, typeFilter]);

  const openDetail = (community) => {
    navigate(`/admin/communities/${communitySegment(community)}`);
  };

  const handleConfirmDelete = async () => {
    if (!communityToDelete) return;

    setDeleting(true);
    try {
      await deleteCommunity(communityToDelete.id);
      setCommunityToDelete(null);
      await loadCommunities();
      showToast("Community deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete community.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Communities ({summary.all})
          </h1>
          <p className="text-sm text-fo-subtle">
            {search.trim()
              ? `${filteredCommunities.length} result${filteredCommunities.length === 1 ? "" : "s"} for this search`
              : `Showing ${filteredCommunities.length} of ${summary[typeFilter] ?? summary.all} communities`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadCommunities}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
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

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by community name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading communities…
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No communities found.
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No communities match your search.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCommunities.map((c) => (
            <article
              key={c.id}
              className="group flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
            >
              <button
                type="button"
                onClick={() => openDetail(c)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <CommunityThumb community={c} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors truncate">
                      {c.name || "Community"}
                    </h2>
                    <span className="text-[10px] text-fo-subtle">
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                  </div>
                  {c.description ? (
                    <p className="text-xs text-fo-muted line-clamp-1">
                      {c.description}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-fo-subtle flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} />
                      {c.memberCount ?? 0} members
                    </span>
                    {c.owner?.username ? (
                      <>
                        <span>·</span>
                        <span>{c.owner.username}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-fo-subtle group-hover:text-fo-accent shrink-0 transition-colors hidden sm:block"
                />
              </button>

              <button
                type="button"
                onClick={() => setCommunityToDelete(c)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors shrink-0"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </article>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(communityToDelete)}
        title="Delete community?"
        variant="admin"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setCommunityToDelete(null)}
      >
        <p>
          Are you sure you want to delete{" "}
          <strong className="text-fo-text font-semibold">
            {communityToDelete?.name}
          </strong>
          ? This cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
