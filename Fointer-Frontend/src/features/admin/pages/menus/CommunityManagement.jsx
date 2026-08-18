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
        className="w-12 h-12 rounded-lg object-cover border border-[#2A241E] shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg bg-[#1A1510] border border-[#2A241E] flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-[#D4AF37]/60">
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
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Communities
          </h1>
          <p className="text-sm text-[#8C8070]">
            Browse communities and remove them when needed.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCommunities}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by community name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading communities…
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
          No communities found.
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
          No communities match your search.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCommunities.map((c) => (
            <article
              key={c.id}
              className="group flex items-center gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
            >
              <button
                type="button"
                onClick={() => openDetail(c)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <CommunityThumb community={c} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-[#E5E0D8] group-hover:text-[#D4AF37] transition-colors truncate">
                      {c.name || "Community"}
                    </h2>
                    <span className="text-[10px] text-[#8C8070]">
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                  </div>
                  {c.description ? (
                    <p className="text-xs text-[#A69B8D] line-clamp-1">
                      {c.description}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-[#8C8070] flex items-center gap-2 flex-wrap">
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
                  className="text-[#5C5348] group-hover:text-[#D4AF37] shrink-0 transition-colors hidden sm:block"
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
          <strong className="text-[#E5E0D8] font-semibold">
            {communityToDelete?.name}
          </strong>
          ? This cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
