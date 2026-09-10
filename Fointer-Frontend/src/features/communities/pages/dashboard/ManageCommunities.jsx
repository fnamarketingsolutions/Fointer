import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuUsers as Users,
  LuSearch as Search,
  LuPlus as Plus,
  LuCircleHelp as HelpCircle,
  LuFolders as Folders,
  LuRefreshCw as RefreshCw
} from "react-icons/lu";
import {
  fetchMyCommunities,
  fetchCommunityManage,
  deleteCommunity,
} from "../../../../api/communities";
import CommunityDetail from "./CommunityDetail";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import EditCommunityModal from "../../../../shared/components/modals/EditCommunityModal";
import CreateCommunityModal from "../../../../shared/components/modals/CreateCommunityModal";
import HelpSupportModal from "../../../../shared/components/modals/HelpSupportModal";
import { formatCommunityType } from "../../../../shared/utils/community";
import { timeAgo } from "../../../../shared/utils/date";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { communitySegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";
import { useToast } from "../../../../shared/components/feedback/ToastContext";

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "owner", label: "Owned" },
  { id: "moderator", label: "Moderating" },
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

export default function ManageCommunities() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id: selectedId, notFound: communityNotFound } = useEntityId(
    "community",
    communityId
  );

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [deletingCommunity, setDeletingCommunity] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [manageData, setManageData] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    return {
      all: communities.length,
      owner: communities.filter(
        (c) => !c.membershipRole || c.membershipRole === "owner"
      ).length,
      moderator: communities.filter((c) => c.membershipRole === "moderator")
        .length,
    };
  }, [communities]);

  const filteredCommunities = useMemo(() => {
    let list = communities;
    if (filter === "owner") {
      list = list.filter(
        (c) => !c.membershipRole || c.membershipRole === "owner"
      );
    } else if (filter === "moderator") {
      list = list.filter((c) => c.membershipRole === "moderator");
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) => (c.name || "").toLowerCase().includes(query));
  }, [communities, filter, search]);

  const loadCommunities = useCallback(
    async (opts = {}) => {
      const keepExisting = Boolean(opts.keepExisting);
      if (!keepExisting) {
        setLoading(true);
      }
      try {
        const data = await fetchMyCommunities({ manage: true });
        setCommunities(data?.communities || []);
      } catch (err) {
        showToast(getErrorMessage(err, "Failed to load communities."));
        if (!keepExisting) {
          setCommunities([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const loadManage = useCallback(
    async (id, opts = {}) => {
      if (!id) return;
      const silent = Boolean(opts.silent);
      if (!silent) {
        setManageLoading(true);
      }
      try {
        const data = await fetchCommunityManage(id);
        setManageData(data);
      } catch (err) {
        showToast(getErrorMessage(err, "Failed to load community."));
        if (!silent) {
          setManageData(null);
        }
      } finally {
        if (!silent) {
          setManageLoading(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (selectedId) {
      loadManage(selectedId);
    } else {
      setManageData(null);
    }
  }, [selectedId, loadManage]);

  const openCommunity = (community) => {
    navigate(`/manage-community/${communitySegment(community)}`);
  };

  const backToList = () => {
    setManageData(null);
    navigate("/manage-community");
    loadCommunities({ keepExisting: true });
  };

  const openEdit = (community) => {
    setEditingCommunity(community);
  };

  const closeEdit = () => {
    setEditingCommunity(null);
  };

  const handleEditSuccess = async (updatedCommunity) => {
    if (updatedCommunity?.id) {
      setCommunities((prev) =>
        prev.map((c) =>
          String(c.id) === String(updatedCommunity.id)
            ? { ...c, ...updatedCommunity }
            : c
        )
      );
      setManageData((prev) =>
        prev?.community &&
        String(prev.community.id) === String(updatedCommunity.id)
          ? {
              ...prev,
              community: { ...prev.community, ...updatedCommunity },
            }
          : prev
      );
    }
    setEditingCommunity(null);
    await loadCommunities({ keepExisting: true });
    if (selectedId) {
      await loadManage(selectedId, { silent: true });
    }
  };

  const openDelete = (community) => {
    setDeletingCommunity(community);
  };

  const closeDelete = () => {
    setDeletingCommunity(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCommunity) return;

    setDeleting(true);
    try {
      await deleteCommunity(deletingCommunity.id);
      closeDelete();
      if (selectedId === deletingCommunity.id) {
        backToList();
      } else {
        await loadCommunities();
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete community."));
    } finally {
      setDeleting(false);
    }
  };

  if (communityId && !selectedId && !communityNotFound) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-fo-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading community...
      </div>
    );
  }

  if (selectedId) {
    return (
      <>
        <CommunityDetail
          manageData={manageData}
          manageLoading={manageLoading}
          selectedId={selectedId}
          onBack={backToList}
          onEdit={openEdit}
          onDelete={openDelete}
          onRefresh={loadManage}
        />

        <EditCommunityModal
          community={editingCommunity}
          onClose={closeEdit}
          onSuccess={handleEditSuccess}
        />

        {deletingCommunity && (
          <ConfirmDeleteModal
            open
            title="Delete Community"
            variant="dashboard"
            loading={deleting}
            onConfirm={handleDeleteConfirm}
            onClose={closeDelete}
          >
            <>
              Are you sure you want to delete{" "}
              <span className="text-fo-text font-semibold">
                {deletingCommunity.name}
              </span>
              ? This action cannot be undone.
            </>
          </ConfirmDeleteModal>
        )}
      </>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Manage Communities
          </h1>
          <p className="text-sm text-fo-subtle">
            Communities you own or moderate — members, requests, and settings.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadCommunities()}
            disabled={loading}
            className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors"
            title="Help"
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover transition-colors"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {ROLE_FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-[10px] opacity-70">
                {counts[item.id] ?? 0}
              </span>
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
          type="search"
          placeholder="Search by community name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </div>

      {loading && communities.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading communities…
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
          <Folders className="w-8 h-8 mx-auto text-fo-accent/40" />
          <p>You do not own or moderate any communities yet.</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
          >
            <Plus size={14} /> Create Community
          </button>
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4">
          No communities match your search.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCommunities.map((item) => {
            const ownerName =
              item.owner?.name || item.owner?.username || "You";
            const role =
              item.membershipRole && item.membershipRole !== "owner"
                ? item.membershipRole
                : "owner";

            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openCommunity(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openCommunity(item);
                  }
                }}
                className="group flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors cursor-pointer"
              >
                <CommunityThumb community={item} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors truncate">
                      {item.name || "Community"}
                    </h2>
                    <span className="text-[10px] text-fo-subtle">
                      {formatCommunityType(item.type)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-fo-accent/80">
                      {role}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="text-[11px] text-fo-subtle line-clamp-1">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} />
                      {item.memberCount ?? 1} members
                    </span>
                    <span>·</span>
                    <span>Owner {ownerName}</span>
                    {item.createdAt ? (
                      <>
                        <span>·</span>
                        <span>{timeAgo(item.createdAt)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-fo-accent/70 group-hover:text-fo-accent">
                  Manage
                </span>
              </article>
            );
          })}
        </div>
      )}

      <CreateCommunityModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => loadCommunities({ keepExisting: true })}
      />

      <HelpSupportModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
