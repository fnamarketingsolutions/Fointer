import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Radio,
  Users,
  Globe,
  Lock,
  Video,
  Search,
  Check,
  X,
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  fetchWatchGroups,
  fetchWatchGroupJoinRequests,
  approveWatchGroupJoinRequest,
  denyWatchGroupJoinRequest,
  closeWatchGroup,
} from "../services/watchGroupService";
import CreateWatchGroupModal from "./CreateWatchGroupModal";
import WatchGroupJoinAction from "./WatchGroupJoinAction";
import WatchGroupChatPage from "./WatchGroupChatPage";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../shared/utils/errors";
import { useAuth } from "../../../context/AuthContext";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "created", label: "Created" },
  { id: "joined", label: "Joined" },
  { id: "available", label: "Available" },
];

export default function WatchGroups() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingByGroup, setPendingByGroup] = useState({});
  const [pendingLoadingId, setPendingLoadingId] = useState(null);
  const [requestBusyId, setRequestBusyId] = useState(null);

  // Active Group Chat State for 50/50 Panel Split
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWatchGroups();
      setGroups(data?.watchGroups || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load watch groups."));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreatedByMe = useCallback(
    (group) => {
      if (group.myRole === "owner") return true;
      const creatorId = group.createdBy?.id || group.createdBy?._id;
      return (
        currentUserId &&
        creatorId &&
        String(creatorId) === String(currentUserId)
      );
    },
    [currentUserId]
  );

  const isJoined = useCallback(
    (group) => Boolean(group.myRole) && !isCreatedByMe(group),
    [isCreatedByMe]
  );

  const isAvailable = useCallback(
    (group) => !group.myRole,
    []
  );

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (statusFilter === "created") {
      list = list.filter((g) => isCreatedByMe(g));
    } else if (statusFilter === "joined") {
      list = list.filter((g) => isJoined(g));
    } else if (statusFilter === "available") {
      list = list.filter((g) => isAvailable(g));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) =>
        String(g.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [groups, statusFilter, search, isCreatedByMe, isJoined, isAvailable]);

  const markJoined = (group) => {
    setGroups((list) =>
      list.map((g) =>
        String(g.id) === String(group.id)
          ? {
              ...g,
              myRole: "member",
              myJoinRequestStatus: null,
              participantCount: (g.participantCount || 0) + 1,
            }
          : g
      )
    );
  };

  const markRequested = (group) => {
    setGroups((list) =>
      list.map((g) =>
        String(g.id) === String(group.id)
          ? { ...g, myJoinRequestStatus: "pending" }
          : g
      )
    );
  };

  const canOpenGroup = useCallback(
    (group) => Boolean(group?.myRole || group?.canManage),
    []
  );

  const handleSelectGroup = (group) => {
    if (!canOpenGroup(group)) return;
    setActiveGroupId(group.id);
  };

  const confirmDeleteGroup = async () => {
    if (!deletingGroup?.id) return;
    setDeleteGroupLoading(true);
    try {
      await closeWatchGroup(deletingGroup.id);
      showToast("Watch group deleted.");
      if (String(activeGroupId) === String(deletingGroup.id)) {
        setActiveGroupId(null);
      }
      setDeletingGroup(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete watch group."));
    } finally {
      setDeleteGroupLoading(false);
    }
  };

  const loadPendingForGroup = async (group, e) => {
    e?.stopPropagation?.();
    if (pendingByGroup[group.id]) {
      setPendingByGroup((prev) => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
      return;
    }
    setPendingLoadingId(group.id);
    try {
      const data = await fetchWatchGroupJoinRequests(group.id, {
        status: "pending",
      });
      setPendingByGroup((prev) => ({
        ...prev,
        [group.id]: data?.requests || [],
      }));
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load join requests."));
    } finally {
      setPendingLoadingId(null);
    }
  };

  const handleApprove = async (groupId, requestId, e) => {
    e?.stopPropagation?.();
    setRequestBusyId(requestId);
    try {
      await approveWatchGroupJoinRequest(groupId, requestId);
      showToast("Join request approved.");
      setPendingByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(
          (r) => String(r.id) !== String(requestId)
        ),
      }));
      setGroups((list) =>
        list.map((g) =>
          String(g.id) === String(groupId)
            ? {
                ...g,
                pendingRequestCount: Math.max(
                  0,
                  (g.pendingRequestCount || 1) - 1
                ),
                participantCount: (g.participantCount || 0) + 1,
              }
            : g
        )
      );
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to approve request."));
    } finally {
      setRequestBusyId(null);
    }
  };

  const handleDeny = async (groupId, requestId, e) => {
    e?.stopPropagation?.();
    setRequestBusyId(requestId);
    try {
      await denyWatchGroupJoinRequest(groupId, requestId);
      showToast("Join request denied.");
      setPendingByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(
          (r) => String(r.id) !== String(requestId)
        ),
      }));
      setGroups((list) =>
        list.map((g) =>
          String(g.id) === String(groupId)
            ? {
                ...g,
                pendingRequestCount: Math.max(
                  0,
                  (g.pendingRequestCount || 1) - 1
                ),
              }
            : g
        )
      );
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to deny request."));
    } finally {
      setRequestBusyId(null);
    }
  };

  const showMobileChat = Boolean(activeGroupId);

  return (
    <div className="-my-4 sm:-my-6 md:-my-8 h-[calc(100vh-4rem)] flex gap-0 md:gap-4 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.07),transparent_55%),linear-gradient(to_bottom_right,#0E0C0A,#14100D,#1A140F)]">
      {/* LEFT PANEL: Watch Groups List — full on mobile when no chat; 50% on md+ */}
      <div
        className={`${
          showMobileChat ? "hidden md:flex" : "flex"
        } w-full md:w-1/2 flex-col h-full gap-3 overflow-hidden shrink-0 pt-3 sm:pt-4 px-0`}
      >
        <div className="flex items-start justify-between gap-3 shrink-0 px-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-serif font-semibold text-[#E5E0D8] flex items-center gap-2">
              <Video size={22} className="text-[#D4AF37]" />
              Watch Groups
            </h1>
            <p className="text-xs text-[#A69B8D] mt-1">
              Create Watch Groups rooms for your communities.
            </p>
            <div className="relative mt-3 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by group name…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0E0C0A]/80 border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              Create Group
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 px-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] border capitalize transition-all ${
                statusFilter === tab.id
                  ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                  : "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Vertical List — scrollbar hidden */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading watch groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center px-4 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                <Radio size={22} className="text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-sm text-[#E5E0D8] font-medium">
                  No watch groups yet
                </p>
                <p className="text-xs text-[#8C8070] mt-1 max-w-sm mx-auto">
                  Create a public or private group to start real-time commentary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs font-bold"
              >
                <Plus size={14} />
                Create your first group
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center px-4">
              <p className="text-sm text-[#E5E0D8] font-medium">
                No matching groups
              </p>
              <p className="text-xs text-[#8C8070] mt-1">
                Try another status filter or search term.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const TypeIcon = group.type === "private" ? Lock : Globe;
              const created = isCreatedByMe(group);
              const member = Boolean(group.myRole);
              const canManage = Boolean(group.canManage);
              const canOpen = canOpenGroup(group);
              const pendingCount = group.pendingRequestCount || 0;
              const pendingOpen = Boolean(pendingByGroup[group.id]);
              const pendingRequests = pendingByGroup[group.id] || [];
              const isSelected = String(group.id) === String(activeGroupId);

              return (
                <div
                  key={group.id}
                  className={`bg-[#14100D] border-x-0 border-t-0 border-b px-2 py-2.5 space-y-2.5 transition-all ${
                    isSelected
                      ? "border-[#D4AF37] bg-[#1A140F] border-b-2"
                      : "border-[#D4AF37]/70 hover:border-[#D4AF37]"
                  }`}
                >
                  <div
                    className={`space-y-2 ${canOpen ? "cursor-pointer" : ""}`}
                    onClick={() => handleSelectGroup(group)}
                    role={canOpen ? "button" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!canOpen) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectGroup(group);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-base text-[#E5E0D8] leading-snug min-w-0 flex-1 truncate">
                        {group.name}
                      </h3>
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!member ? (
                          <WatchGroupJoinAction
                            group={group}
                            onJoined={(g) => {
                              markJoined(g);
                              setActiveGroupId(g.id);
                            }}
                            onRequested={markRequested}
                          />
                        ) : null}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                            group.type === "private"
                              ? "bg-[#2A241E] text-[#A69B8D]"
                              : "bg-[#D4AF37]/15 text-[#D4AF37]"
                          }`}
                        >
                          <TypeIcon size={10} />
                          {group.type}
                        </span>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingGroup(group);
                            }}
                            className="p-1.5 rounded-md text-red-300 hover:bg-red-400/10 transition-colors"
                            title="Delete group"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8C8070] font-mono uppercase tracking-wider truncate">
                      {group.community?.name || "No community"}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#A69B8D] pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} className="text-[#D4AF37]" />
                        {group.participantCount ?? 0}/{group.maxParticipants}{" "}
                        participants
                      </span>
                      <span className="capitalize text-[#D4AF37]/80 font-medium">
                        {created
                          ? "Created"
                          : member
                            ? group.myRole || "Joined"
                            : canManage
                              ? "Moderate"
                              : "Available"}
                      </span>
                    </div>
                  </div>

                  {created && pendingCount > 0 && (
                    <div className="pt-1 space-y-2">
                      <button
                        type="button"
                        onClick={(e) => loadPendingForGroup(group, e)}
                        className="w-full inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[#D4AF37]/30 text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                      >
                        <span>
                          {pendingCount} pending request
                          {pendingCount === 1 ? "" : "s"}
                        </span>
                        {pendingLoadingId === group.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide">
                            {pendingOpen ? "Hide" : "Review"}
                          </span>
                        )}
                      </button>

                      {pendingOpen && (
                        <div className="space-y-2">
                          {pendingRequests.length === 0 ? (
                            <p className="text-[11px] text-[#8C8070] px-1">
                              No pending requests.
                            </p>
                          ) : (
                            pendingRequests.map((req) => (
                              <div
                                key={req.id}
                                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs text-[#E5E0D8] truncate">
                                    @{req.user?.username || "user"}
                                  </p>
                                  {req.user?.name ? (
                                    <p className="text-[10px] text-[#8C8070] truncate">
                                      {req.user.name}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={requestBusyId === req.id}
                                    onClick={(e) =>
                                      handleApprove(group.id, req.id, e)
                                    }
                                    className="p-1.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25 disabled:opacity-50"
                                    title="Approve"
                                  >
                                    {requestBusyId === req.id ? (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check size={12} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={requestBusyId === req.id}
                                    onClick={(e) =>
                                      handleDeny(group.id, req.id, e)
                                    }
                                    className="p-1.5 rounded-md bg-[#2A241E] text-[#A69B8D] hover:text-red-300 disabled:opacity-50"
                                    title="Deny"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT / FULL PANEL: Chat — full width on mobile when open; 50% on md+ */}
      <div
        className={`${
          showMobileChat ? "flex" : "hidden md:flex"
        } w-full md:w-1/2 h-full flex-col min-h-0 p-0`}
      >
        {activeGroupId ? (
          <WatchGroupChatPage
            key={activeGroupId}
            groupId={activeGroupId}
            onBack={() => setActiveGroupId(null)}
            onGroupClosed={() => {
              setActiveGroupId(null);
              load();
            }}
            onMemberRemoved={() => load()}
          />
        ) : (
          <div className="h-full bg-[#0F0C09]/80 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#14100D] flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-[#8C8070]" />
            </div>
            <h2 className="text-base font-semibold text-[#E5E0D8]">
              No Chat Selected
            </h2>
            <p className="text-xs text-[#8C8070] mt-1 max-w-xs">
              Select a joined watch group from the list on the left to start viewing and sending messages.
            </p>
          </div>
        )}
      </div>

      <CreateWatchGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={load}
      />

      <ConfirmDeleteModal
        open={Boolean(deletingGroup)}
        title="Delete watch group"
        variant="dashboard"
        confirmLabel="Delete group"
        onClose={() => setDeletingGroup(null)}
        onConfirm={confirmDeleteGroup}
        loading={deleteGroupLoading}
      >
        Delete &ldquo;{deletingGroup?.name || "this group"}&rdquo;? This closes
        the group for all members and removes it from active watch groups.
      </ConfirmDeleteModal>
    </div>
  );
}