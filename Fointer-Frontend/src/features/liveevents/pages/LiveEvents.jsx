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
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  fetchLiveEvents,
  joinLiveEvent,
  closeLiveEvent,
} from "../services/liveEventService";
import LiveEventRoomPage from "./LiveEventRoomPage";
import CreateLiveEventModal from "../../../shared/components/modals/CreateLiveEventModal";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../shared/utils/errors";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "created", label: "Created" },
  { id: "joined", label: "Joined" },
  { id: "available", label: "Available" },
];

const CATEGORY_LABELS = {
  sports: "Sports",
  entertainment: "Entertainment",
  news: "News",
  custom: "Custom",
};

export default function LiveEvents() {
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeEventId, setActiveEventId] = useState(null);
  const [joinBusyId, setJoinBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLiveEvents();
      setEvents(data?.liveEvents || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load live events."));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreatedByMe = (event) => event?.myRole === "owner";

  const canOpenEvent = useCallback(
    (event) => Boolean(event?.myRole || event?.canManage),
    []
  );

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => {
      if (statusFilter === "created" && !isCreatedByMe(event) && !event.canManage) {
        return false;
      }
      if (statusFilter === "joined" && !event.myRole) return false;
      if (statusFilter === "available" && event.myRole) return false;
      if (q) {
        const hay = `${event.title || ""} ${event.community?.name || ""} ${
          event.category || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, statusFilter]);

  const handleJoin = async (event) => {
    if (!event?.id || joinBusyId) return;
    setJoinBusyId(event.id);
    try {
      const data = await joinLiveEvent(event.id);
      const updated = data?.liveEvent;
      setEvents((list) =>
        list.map((row) =>
          String(row.id) === String(event.id)
            ? { ...row, ...updated, myRole: updated?.myRole || "member" }
            : row
        )
      );
      showToast("Joined live event.");
      setActiveEventId(event.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to join live event."));
    } finally {
      setJoinBusyId(null);
    }
  };

  const handleSelectEvent = (event) => {
    if (!canOpenEvent(event)) return;
    setActiveEventId(event.id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    setDeleteLoading(true);
    try {
      await closeLiveEvent(deleteTarget.id);
      showToast("Live event deleted.");
      if (String(activeEventId) === String(deleteTarget.id)) {
        setActiveEventId(null);
      }
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete live event."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const showMobileRoom = Boolean(activeEventId);

  return (
    <div className="-my-4 sm:-my-6 md:-my-8 h-[calc(100vh-4rem)] flex gap-0 md:gap-4 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.07),transparent_55%),linear-gradient(to_bottom_right,#0E0C0A,#14100D,#1A140F)]">
      <div
        className={`${
          showMobileRoom ? "hidden md:flex" : "flex"
        } w-full md:w-1/2 flex-col h-full gap-3 overflow-hidden shrink-0 pt-3 sm:pt-4 px-0`}
      >
        <div className="flex items-start justify-between gap-3 shrink-0 px-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-serif font-semibold text-[#E5E0D8] flex items-center gap-2">
              <Video size={22} className="text-[#D4AF37]" />
              Live Events
            </h1>
            <p className="text-xs text-[#A69B8D] mt-1">
              Real-time live commentary for your communities.
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
                placeholder="Search by event title…"
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
              Start Live Commentary
            </button>
          </div>
        </div>

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

        <div className="flex-1 overflow-y-auto space-y-3 pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading live events...
            </div>
          ) : events.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center px-4 space-y-4 mx-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                <Radio size={22} className="text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-sm text-[#E5E0D8] font-medium">
                  No live events yet
                </p>
                <p className="text-xs text-[#8C8070] mt-1 max-w-sm mx-auto">
                  Start live commentary as a community owner or moderator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs font-bold"
              >
                <Plus size={14} />
                Start Live Commentary
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center px-4 mx-2">
              <p className="text-sm text-[#E5E0D8] font-medium">
                No matching events
              </p>
              <p className="text-xs text-[#8C8070] mt-1">
                Try another filter or search term.
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const AccessIcon =
                event.access === "community_restricted" ? Lock : Globe;
              const created = isCreatedByMe(event);
              const member = Boolean(event.myRole);
              const canManage = Boolean(event.canManage);
              const canOpen = canOpenEvent(event);
              const isSelected = String(event.id) === String(activeEventId);
              const joining = String(joinBusyId) === String(event.id);

              return (
                <div
                  key={event.id}
                  className={`bg-[#14100D] border-x-0 border-t-0 border-b px-2 py-2.5 space-y-2.5 transition-all ${
                    isSelected
                      ? "border-[#D4AF37] bg-[#1A140F] border-b-2"
                      : "border-[#D4AF37]/70 hover:border-[#D4AF37]"
                  }`}
                >
                  <div
                    className={`space-y-2 ${canOpen ? "cursor-pointer" : ""}`}
                    onClick={() => handleSelectEvent(event)}
                    role={canOpen ? "button" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!canOpen) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectEvent(event);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-base text-[#E5E0D8] leading-snug min-w-0 flex-1 truncate">
                        {event.title}
                      </h3>
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!member ? (
                          <button
                            type="button"
                            disabled={joining}
                            onClick={() => handleJoin(event)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-[11px] font-bold disabled:opacity-50"
                          >
                            {joining ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Radio size={12} />
                            )}
                            Join
                          </button>
                        ) : null}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                            event.access === "community_restricted"
                              ? "bg-[#2A241E] text-[#A69B8D]"
                              : "bg-[#D4AF37]/15 text-[#D4AF37]"
                          }`}
                        >
                          <AccessIcon size={10} />
                          {event.access === "community_restricted"
                            ? "Restricted"
                            : "Public"}
                        </span>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(event);
                            }}
                            className="p-1.5 rounded-md text-red-300 hover:bg-red-400/10 transition-colors"
                            title="Delete event"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8C8070] font-mono uppercase tracking-wider truncate">
                      {event.community?.name || "Community"} ·{" "}
                      {CATEGORY_LABELS[event.category] || event.category}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#A69B8D] pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} className="text-[#D4AF37]" />
                        {event.participantCount ?? 0} watching
                      </span>
                      <span className="capitalize text-[#D4AF37]/80 font-medium">
                        {created
                          ? "Created"
                          : member
                            ? event.myRole || "Joined"
                            : canManage
                              ? "Moderate"
                              : "Available"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        className={`${
          showMobileRoom ? "flex" : "hidden md:flex"
        } w-full md:w-1/2 h-full flex-col min-h-0 p-0`}
      >
        {activeEventId ? (
          <LiveEventRoomPage
            eventId={activeEventId}
            onBack={() => setActiveEventId(null)}
            onEventClosed={() => {
              setActiveEventId(null);
              load();
            }}
          />
        ) : (
          <div className="h-full bg-[#0F0C09]/80 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#14100D] flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-[#8C8070]" />
            </div>
            <h2 className="text-base font-semibold text-[#E5E0D8]">
              No Event Selected
            </h2>
            <p className="text-xs text-[#8C8070] mt-1 max-w-xs">
              Select a joined live event from the list on the left to follow
              real-time commentary.
            </p>
          </div>
        )}
      </div>

      <CreateLiveEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={load}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete live event?"
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        confirmLabel="Delete"
        variant="dashboard"
      >
        This will permanently close{" "}
        <span className="text-[#E5E0D8] font-medium">
          {deleteTarget?.title}
        </span>
        .
      </ConfirmDeleteModal>
    </div>
  );
}
