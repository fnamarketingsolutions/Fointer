import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  deleteAdminLiveEvent,
  deleteAdminLiveMessage,
  endAdminLiveEvent,
  fetchAdminLiveEvents,
  fetchAdminLiveMessages,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "ended", label: "Ended" },
];

const CATEGORY_LABELS = {
  sports: "Sports",
  entertainment: "Entertainment",
  news: "News",
  custom: "Custom",
};

const categoryLabel = (event) => {
  if (event.category === "custom") {
    return event.customCategory || "Custom";
  }
  return CATEGORY_LABELS[event.category] || event.category || "—";
};

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-[#2A241E] text-[#A69B8D] hover:text-[#E5E0D8] hover:border-[#D4AF37]/30",
    primary:
      "border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
    warn:
      "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
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

export default function LiveEventManagement() {
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({ all: 0, live: 0, ended: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminLiveEvents({ status: "all" });
      setEvents(data?.events || []);
      setSummary(data?.summary || { all: 0, live: 0, ended: 0 });
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load live events."));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (filter === "live" || filter === "ended") {
      list = list.filter((e) => e.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((event) => {
      const hay = [
        event.title,
        event.category,
        event.customCategory,
        event.community?.name,
        event.host?.name,
        event.host?.username,
        event.access,
        event.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, search]);

  const counts = useMemo(() => {
    if (!search.trim()) {
      return {
        all: summary.all || events.length,
        live: summary.live ?? events.filter((e) => e.status === "live").length,
        ended:
          summary.ended ?? events.filter((e) => e.status === "ended").length,
      };
    }
    return {
      all: filteredEvents.length,
      live: filteredEvents.filter((e) => e.status === "live").length,
      ended: filteredEvents.filter((e) => e.status === "ended").length,
    };
  }, [events, filteredEvents, search, summary]);

  const handleEnd = async (event) => {
    if (!window.confirm(`End live event "${event.title}"?`)) return;
    setBusyId(event.id);
    try {
      await endAdminLiveEvent(event.id);
      showToast("Live event ended.");
      await loadEvents();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to end live event."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (event) => {
    if (
      !window.confirm(
        `Delete "${event.title}" and all commentary messages? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(event.id);
    try {
      await deleteAdminLiveEvent(event.id);
      showToast("Live event deleted.");
      if (activeEvent?.id === event.id) {
        setMessagesOpen(false);
        setActiveEvent(null);
        setMessages([]);
      }
      await loadEvents();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete live event."));
    } finally {
      setBusyId(null);
    }
  };

  const openMessages = async (event) => {
    setActiveEvent(event);
    setMessagesOpen(true);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const data = await fetchAdminLiveMessages(event.id, { limit: 300 });
      setMessages(data?.messages || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load messages."));
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeEvent) return;
    setDeletingMessageId(messageId);
    try {
      await deleteAdminLiveMessage(activeEvent.id, messageId);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
      setEvents((prev) =>
        prev.map((e) =>
          e.id === activeEvent.id
            ? {
                ...e,
                messageCount: Math.max(0, (e.messageCount || 1) - 1),
              }
            : e
        )
      );
      showToast("Message removed.");
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to remove message."));
    } finally {
      setDeletingMessageId(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Live Events
          </h1>
          <p className="text-sm text-[#8C8070]">
            Monitor commentary rooms, remove messages, end or delete events.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {STATUS_FILTERS.map((item) => {
          const active = filter === item.id;
          const count =
            item.id === "all"
              ? counts.all
              : item.id === "live"
                ? counts.live
                : counts.ended;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
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
          type="search"
          placeholder="Search by title, community, host…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading live events…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
          <p>No live events found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map((event) => {
            const isBusy = busyId === event.id;
            const isLive = event.status === "live";

            return (
              <article
                key={event.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-red-400">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        Live
                      </span>
                    ) : (
                      <span className="font-medium text-[#8C8070]">Ended</span>
                    )}
                    <span>·</span>
                    <span className="text-[#A69B8D]">{categoryLabel(event)}</span>
                    <span>·</span>
                    <span>
                      {event.access === "public"
                        ? "Public"
                        : "Community-restricted"}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(event.createdAt)}</span>
                  </div>

                  <h2 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
                    {event.title}
                  </h2>

                  <p className="text-[11px] text-[#8C8070]">
                    {event.community?.name || "Unknown community"}
                    {" · Host "}
                    {event.host?.username || event.host?.name || "Unknown"}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-[#8C8070]">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={11} />
                      {event.messageCount || 0} messages
                    </span>
                    {event.endedAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} />
                        Ended {timeAgo(event.endedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <ActionBtn
                    tone="primary"
                    onClick={() => openMessages(event)}
                  >
                    <MessageSquare size={12} />
                    Messages
                  </ActionBtn>
                  {isLive ? (
                    <ActionBtn
                      tone="warn"
                      disabled={isBusy}
                      onClick={() => handleEnd(event)}
                    >
                      {isBusy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      End
                    </ActionBtn>
                  ) : null}
                  <ActionBtn
                    tone="danger"
                    disabled={isBusy}
                    onClick={() => handleDelete(event)}
                  >
                    {isBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Delete
                  </ActionBtn>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {messagesOpen && activeEvent ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setMessagesOpen(false)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#2A241E] shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#E5E0D8] truncate">
                  {activeEvent.title}
                </h2>
                <p className="text-[11px] text-[#8C8070] mt-0.5">
                  Moderate commentary messages
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMessagesOpen(false)}
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1A1510] shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[200px]">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#A69B8D] gap-2">
                  <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-[#8C8070] text-sm py-10">
                  No messages in this event.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex gap-3 p-3 rounded-xl border border-[#2A241E] bg-[#0E0C0A]"
                  >
                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border border-[#2A241E] bg-[#1A1510] text-[#D4AF37]">
                      {(
                        msg.author?.name ||
                        msg.author?.username ||
                        "?"
                      )[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#E5E0D8] truncate">
                          {msg.author?.name ||
                            msg.author?.username ||
                            "Member"}
                        </p>
                        <button
                          type="button"
                          disabled={deletingMessageId === msg.id}
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="shrink-0 p-1 text-red-400/70 hover:text-red-400 disabled:opacity-50"
                          title="Remove message"
                        >
                          {deletingMessageId === msg.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-[#A69B8D] mt-0.5 whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                      <p className="text-[10px] text-[#5C5348] mt-1">
                        {msg.createdAt ? timeAgo(msg.createdAt) : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
