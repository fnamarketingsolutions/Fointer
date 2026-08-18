import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuPlus as Plus,
  LuRadio as Radio,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuX as X,
  LuCircleX as XCircle
} from "react-icons/lu";
import {
  createLiveEvent,
  deleteLiveEvent,
  endLiveEvent,
  fetchHostableCommunities,
  fetchLiveEvents,
} from "../../../../api/liveEvents";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../../context/AuthContext";
import { timeAgo } from "../../../../shared/utils/date";

const ACCESS_FILTERS = [
  { id: "all", label: "All" },
  { id: "public", label: "Public" },
  { id: "community", label: "Community" },
];

const CATEGORIES = [
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "news", label: "News" },
  { value: "custom", label: "Custom" },
];

const ACCESS_OPTIONS = [
  { value: "public", label: "Public", hint: "Anyone signed in can join" },
  {
    value: "community",
    label: "Community-Restricted",
    hint: "Only community members",
  },
];

const emptyForm = {
  title: "",
  category: "sports",
  customCategory: "",
  access: "community",
  communityId: "",
};

const categoryLabel = (event) => {
  if (event.category === "custom") {
    return event.customCategory || "Custom";
  }
  return (
    CATEGORIES.find((c) => c.value === event.category)?.label ||
    event.category ||
    ""
  );
};

export default function LiveEvents() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [events, setEvents] = useState([]);
  const [hostable, setHostable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  const canStart = isAuthenticated && hostable.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const eventsRes = await fetchLiveEvents({ status: "live" });
      setEvents(eventsRes?.events || []);

      if (isAuthenticated) {
        try {
          const hostRes = await fetchHostableCommunities();
          const communities = hostRes?.communities || [];
          setHostable(communities);
          setForm((prev) => ({
            ...prev,
            communityId: prev.communityId || communities[0]?.id || "",
          }));
        } catch {
          setHostable([]);
        }
      } else {
        setHostable([]);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load live events.");
    } finally {
      setLoading(false);
    }
  }, [showToast, isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      all: events.length,
      public: events.filter((e) => e.access === "public").length,
      community: events.filter((e) => e.access === "community").length,
    };
  }, [events]);

  const visibleEvents = useMemo(() => {
    let list = events;
    if (filter === "public" || filter === "community") {
      list = list.filter((e) => e.access === filter);
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((e) => {
      const hay = [
        e.title,
        e.access,
        e.category,
        e.customCategory,
        e.community?.name,
        e.host?.name,
        e.host?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [events, filter, search]);

  const openModal = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/live-events" } });
      return;
    }
    setForm({
      ...emptyForm,
      communityId: hostable[0]?.id || "",
    });
    setModalOpen(true);
  };

  const goToEvent = (eventId) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: `/live-events/${eventId}` },
      });
      return;
    }
    navigate(`/live-events/${eventId}`);
  };

  const handleEndEvent = async (event, e) => {
    e?.stopPropagation?.();
    if (!event?.id) return;
    if (!window.confirm("End this live commentary for everyone?")) return;
    setActionId(event.id);
    try {
      await endLiveEvent(event.id);
      showToast("Live event ended.");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to end event.");
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteEvent = async (event, e) => {
    e?.stopPropagation?.();
    if (!event?.id) return;
    if (
      !window.confirm(
        "Delete this live event and all commentary? This cannot be undone."
      )
    ) {
      return;
    }
    setActionId(event.id);
    try {
      await deleteLiveEvent(event.id);
      showToast("Live event deleted.");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete event.");
    } finally {
      setActionId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Event title is required.");
      return;
    }
    if (form.category === "custom" && !form.customCategory.trim()) {
      showToast("Please provide a custom category name.");
      return;
    }
    if (!form.communityId) {
      showToast("Select a community to host from.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createLiveEvent({
        title: form.title.trim(),
        category: form.category,
        customCategory: form.customCategory.trim(),
        access: form.access,
        communityId: form.communityId,
      });
      showToast("Live commentary started.");
      setModalOpen(false);
      const id = res?.event?.id || res?.event?.shortCode;
      if (id) {
        navigate(`/live-events/${id}`);
      } else {
        load();
      }
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to start live commentary."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8] inline-flex items-center gap-2">
            <Radio size={20} className="text-red-500 animate-pulse shrink-0" />
            Live Events
          </h1>
          <p className="text-sm text-[#8C8070]">
            Real-time commentary streams happening right now.
          </p>
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
          {canStart ? (
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a] transition-colors"
            >
              <Plus size={14} /> Start
            </button>
          ) : null}
        </div>
      </header>

      {!canStart && isAuthenticated ? (
        <p className="text-xs text-[#8C8070] border border-dashed border-[#2A241E] rounded-xl px-4 py-3">
          Only community owners and moderators can start live commentary. You
          can still join any public or community-restricted event you have
          access to.
        </p>
      ) : null}

      {!isAuthenticated ? (
        <p className="text-xs text-[#8C8070] border border-dashed border-[#2A241E] rounded-xl px-4 py-3">
          Log in to join a live stream or start commentary.
        </p>
      ) : null}

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {ACCESS_FILTERS.map((item) => {
          const active = filter === item.id;
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
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
        />
        <input
          type="search"
          placeholder="Search live events…"
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
      ) : visibleEvents.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-3">
          <Radio className="w-8 h-8 mx-auto text-red-500/40" />
          <p>
            {events.length === 0
              ? "No live events right now."
              : "No events match your search."}
          </p>
          {events.length === 0 && canStart ? (
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
            >
              <Plus size={14} /> Start Live Commentary
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleEvents.map((event) => {
            const isPublic = event.access === "public";
            return (
              <article
                key={event.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      Live
                    </span>
                    <span>·</span>
                    <span className="text-[#D4AF37]">{categoryLabel(event)}</span>
                    <span>·</span>
                    <span className={isPublic ? "text-emerald-400" : ""}>
                      {isPublic ? "Public" : "Community"}
                    </span>
                    {event.community?.name ? (
                      <>
                        <span>·</span>
                        <span>{event.community.name}</span>
                      </>
                    ) : null}
                    {event.startedAt || event.createdAt ? (
                      <>
                        <span>·</span>
                        <span>{timeAgo(event.startedAt || event.createdAt)}</span>
                      </>
                    ) : null}
                  </div>

                  <h2 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
                    {event.title}
                  </h2>

                  <p className="text-[11px] text-[#8C8070] inline-flex items-center gap-1">
                    <Users size={11} />
                    Host{" "}
                    {event.host?.username || event.host?.name || "unknown"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToEvent(event.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4AF37]/35 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/10 transition-colors"
                  >
                    <MessageCircle size={12} /> Join stream
                  </button>

                  {event.canEnd ? (
                    <button
                      type="button"
                      disabled={actionId === event.id}
                      onClick={(e) => handleEndEvent(event, e)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {actionId === event.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      End
                    </button>
                  ) : null}

                  {event.canDelete ? (
                    <button
                      type="button"
                      disabled={actionId === event.id}
                      onClick={(e) => handleDeleteEvent(event, e)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {actionId === event.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#E5E0D8]">
                Start Live Commentary
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1A1510]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                  Event title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  maxLength={160}
                  required
                  placeholder="e.g. Championship Final Live Thread"
                  className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 placeholder:text-[#5C5348]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, category: cat.value }))
                      }
                      className={`px-3 py-2 rounded-xl text-xs border transition-colors ${
                        form.category === cat.value
                          ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]"
                          : "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {form.category === "custom" ? (
                  <input
                    type="text"
                    value={form.customCategory}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customCategory: e.target.value,
                      }))
                    }
                    maxLength={60}
                    placeholder="Custom category name"
                    className="w-full mt-2 bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 placeholder:text-[#5C5348]"
                  />
                ) : null}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                  Access
                </label>
                <div className="space-y-2">
                  {ACCESS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, access: opt.value }))
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border transition-colors ${
                        form.access === opt.value
                          ? "border-[#D4AF37] bg-[#D4AF37]/10"
                          : "border-[#2A241E] hover:border-[#D4AF37]/40"
                      }`}
                    >
                      <span
                        className={
                          form.access === opt.value
                            ? "text-[#D4AF37] font-semibold"
                            : "text-[#E5E0D8]"
                        }
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[#8C8070] mt-0.5">
                        {opt.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                  Host community
                </label>
                <select
                  value={form.communityId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, communityId: e.target.value }))
                  }
                  required
                  className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
                >
                  {hostable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-1 bg-[#D4AF37] hover:bg-[#e0c04a] text-black font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Starting…
                  </>
                ) : (
                  "Start"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
