import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuSearch as Search,
  LuCircleHelp as HelpCircle,
  LuFolders as Folders,
} from "react-icons/lu";
import CommunityCard from "../../components/CommunityCard";
import CommunitiesRail from "../../components/CommunitiesRail";
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
import { getErrorMessage } from "../../../../shared/utils/errors";
import { communitySegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";
import { useToast } from "../../../../shared/components/feedback/ToastContext";

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "owner", label: "Owned" },
  { id: "moderator", label: "Moderating" },
];

const filterBtnClass = (active) =>
  `relative px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg ${
    active ? "text-fo-accent" : "text-fo-subtle hover:text-fo-text"
  }`;

export default function ManageCommunities() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    if (searchParams.get("create") !== "1") return undefined;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
    return undefined;
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedId) {
      loadManage(selectedId);
    } else {
      setManageData(null);
    }
  }, [selectedId, loadManage]);

  const openCommunity = (community) => {
    navigate(`/communities/manage/${communitySegment(community)}`);
  };

  const backToList = () => {
    setManageData(null);
    navigate("/communities/manage");
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

  const listBody = (
    <>
          <div
            className="flex flex-wrap items-center gap-1 border-b border-fo-border pb-1"
            role="group"
            aria-label="Filter communities"
          >
            {ROLE_FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={filterBtnClass(active)}
                >
                  {item.label}
                  {counts[item.id] != null ? ` (${counts[item.id]})` : ""}
                  {active ? (
                    <span className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-fo-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
            />
            <input
              type="search"
              placeholder="Search communities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-fo-border bg-fo-surface pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredCommunities.map((item) => {
            const role =
              item.membershipRole && item.membershipRole !== "owner"
                ? item.membershipRole
                : "owner";

            return (
              <CommunityCard
                key={item.id}
                community={item}
                onClick={openCommunity}
                badge={role}
              />
            );
          })}
        </div>
      )}
    </>
  );

  const modals = (
    <>
      <CreateCommunityModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => loadCommunities({ keepExisting: true })}
      />
      <HelpSupportModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <button
        type="button"
        onClick={() => navigate("/communities")}
        className="inline-flex items-center gap-2 min-h-9 px-1 mb-3 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
      >
        <ArrowLeft size={16} /> Back to communities
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
                <Folders size={14} aria-hidden /> Manage
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-fo-text leading-tight">
                Manage communities
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug max-w-xl">
                Communities you own or moderate — members, requests, and
                settings.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors"
              >
                <HelpCircle size={15} aria-hidden /> Help
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover transition-colors"
              >
                <Plus size={16} aria-hidden /> Create
              </button>
            </div>
          </div>
          {listBody}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <CommunitiesRail
            managePage
            items={ROLE_FILTERS.map((item) => ({
              ...item,
              count: counts[item.id] || 0,
            }))}
            selectedId={filter}
            onSelect={setFilter}
            isGuest={false}
          />
        </div>
      </div>

      <div className="lg:hidden mt-4">
        <CommunitiesRail
          managePage
          items={ROLE_FILTERS.map((item) => ({
            ...item,
            count: counts[item.id] || 0,
          }))}
          selectedId={filter}
          onSelect={setFilter}
          isGuest={false}
        />
      </div>

      {modals}
    </div>
  );
}
