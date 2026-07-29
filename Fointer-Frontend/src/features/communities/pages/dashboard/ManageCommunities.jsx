import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ChevronRight,
  Users,
  ChevronLeft,
  ShieldAlert,
  Calendar,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import {
  fetchMyCommunities,
  fetchCommunityManage,
  deleteCommunity,
} from "../../../../api/communities";
import CommunityDetail from "./CommunityDetail";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import EditCommunityModal from "../../../../shared/components/modals/EditCommunityModal";
import { formatCommunityType } from "../../../../shared/utils/community";
import { formatDate } from "../../../../shared/utils/date";
import { getErrorMessage } from "../../../../shared/utils/errors";

const formatType = formatCommunityType;

export default function ManageCommunities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [deletingCommunity, setDeletingCommunity] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [manageData, setManageData] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredCommunities = query
    ? communities.filter((c) =>
        (c.name || "").toLowerCase().includes(query)
      )
    : communities;

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyCommunities({ manage: true });
      setCommunities(data?.communities || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load communities."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadManage = useCallback(async (id) => {
    if (!id) return;
    setManageLoading(true);
    setError("");
    try {
      const data = await fetchCommunityManage(id);
      setManageData(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load community."));
      setManageData(null);
    } finally {
      setManageLoading(false);
    }
  }, []);

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
    setSelectedId(community.id);
    setError("");
  };

  const backToList = () => {
    setSelectedId(null);
    setManageData(null);
    setError("");
    loadCommunities();
  };

  const openEdit = (community) => {
    setEditingCommunity(community);
    setError("");
  };

  const closeEdit = () => {
    setEditingCommunity(null);
  };

  const handleEditSuccess = async () => {
    await loadCommunities();
    if (selectedId) {
      await loadManage(selectedId);
    }
  };

  const openDelete = (community) => {
    setDeletingCommunity(community);
    setError("");
  };

  const closeDelete = () => {
    setDeletingCommunity(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCommunity) return;

    setDeleting(true);
    setError("");
    try {
      await deleteCommunity(deletingCommunity.id);
      closeDelete();
      if (selectedId === deletingCommunity.id) {
        backToList();
      } else {
        await loadCommunities();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete community."));
    } finally {
      setDeleting(false);
    }
  };

  if (selectedId) {
    return (
      <>
        <CommunityDetail
          manageData={manageData}
          manageLoading={manageLoading}
          selectedId={selectedId}
          error={error}
          setError={setError}
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
            error={error}
            loading={deleting}
            onConfirm={handleDeleteConfirm}
            onClose={closeDelete}
          >
            <>
              Are you sure you want to delete{" "}
              <span className="text-[#E5E0D8] font-semibold">
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
    <div className="space-y-6 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
          Manage Communities
        </h1>
        <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
          Open a community you own or moderate to review members, join
          requests, and settings.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C8070]" />
        <input
          type="text"
          placeholder="Search by community name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0D0A08] border border-[#2A241E] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-[#8C8070]"
        />
      </div>

      {error && !editingCommunity && !deletingCommunity && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading communities...
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#A69B8D] text-xs sm:text-sm px-4">
          You do not own or moderate any communities yet.
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#8C8070] text-xs sm:text-sm px-4">
          No communities match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCommunities.map((item) => {
            const primaryTag =
              Array.isArray(item.tags) && item.tags.length > 0
                ? item.tags[0].toUpperCase()
                : "NETWORKING";
            const ownerName =
              item.owner?.name || item.owner?.username || "You";
            const galleryCount = item.galleryImages?.length || 0;

            return (
              <div
                key={item.id}
                onClick={() => openCommunity(item)}
                className="group relative flex flex-col rounded-2xl bg-[#0D0A08] border border-[#221C17] hover:border-[#D4AF37]/40 transition-all duration-300 overflow-hidden cursor-pointer shadow-lg"
              >
                {/* Top Banner Image Header */}
                <div className="relative w-full h-44 sm:h-48 bg-[#18130E] overflow-hidden">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1C1712] via-[#2A2119] to-[#0D0A08] flex items-center justify-center">
                      <span className="text-5xl font-serif font-bold text-[#D4AF37]/30">
                        {(item.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Dark overlay for contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A08] via-black/20 to-black/50" />

                  {/* Top Right Type Tag Badge */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#D4AF37]/40 text-[11px] font-medium text-[#D4AF37] shadow-md">
                      <ShieldAlert size={12} className="text-[#D4AF37]" />
                      {formatType(item.type)}
                    </span>
                    {item.membershipRole && item.membershipRole !== "owner" && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-[10px] uppercase tracking-wide text-amber-200">
                        {item.membershipRole}
                      </span>
                    )}
                  </div>

                  {/* Carousel Indicator Navigation Dots (Visual replica) */}
                  {Array.isArray(item.galleryImages) &&
                    item.galleryImages.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/50 text-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/50 text-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </>
                    )}
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Tag Category */}
                    <p className="text-[10px] font-bold tracking-widest text-[#D4AF37] uppercase mb-1">
                      {primaryTag}
                    </p>

                    {/* Community Title */}
                    <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#E5E0D8] mb-2 truncate">
                      {item.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed min-h-[2.5rem]">
                      {item.description || "No description available"}
                    </p>

                    {item.rules && (
                      <p className="text-[11px] text-[#8C8070] line-clamp-1 mt-1.5 italic">
                        Rules: {item.rules}
                      </p>
                    )}

                    {Array.isArray(item.tags) && item.tags.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-[#D4AF37]/10 text-[#D4AF37]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Meta Details */}
                  <div className="pt-4 mt-3 border-t border-[#221C17] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#8C8070] gap-2">
                      <div className="flex items-center gap-1.5 font-medium text-[#A69B8D] min-w-0">
                        <Users size={14} className="text-[#8C8070] shrink-0" />
                        <span>{item.memberCount ?? 1} members</span>
                      </div>
                      {galleryCount > 0 && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <ImageIcon size={12} />
                          {galleryCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#8C8070] gap-2">
                      <span className="truncate">Owner: {ownerName}</span>
                      {item.createdAt && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Calendar size={10} />
                          {formatDate(item.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <span className="font-semibold text-[10px] tracking-wider uppercase text-[#D4AF37]/80">
                        Manage
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
