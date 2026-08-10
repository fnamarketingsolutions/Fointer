import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import {
  deleteAdminWatchGroup,
  deleteAdminWatchMessage,
  fetchAdminWatchGroups,
  fetchAdminWatchMessages,
  fetchAdminWatchParticipants,
  removeAdminWatchParticipant,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
];

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-[#2A241E] text-[#A69B8D] hover:text-[#E5E0D8] hover:border-[#D4AF37]/30",
    primary:
      "border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
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

export default function WatchGroupManagement() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({ all: 0, public: 0, private: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [detailTab, setDetailTab] = useState("messages");
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminWatchGroups({ type: "all" });
      setGroups(data?.groups || []);
      setSummary(data?.summary || { all: 0, public: 0, private: 0 });
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load watch groups."));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (filter === "public" || filter === "private") {
      list = list.filter((g) => g.type === filter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((g) => {
      const hay = [g.name, g.type, g.owner?.name, g.owner?.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [groups, filter, search]);

  const counts = useMemo(() => {
    if (!search.trim() && filter === "all") {
      return {
        all: summary.all || groups.length,
        public:
          summary.public ?? groups.filter((g) => g.type === "public").length,
        private:
          summary.private ?? groups.filter((g) => g.type === "private").length,
      };
    }
    const base = search.trim() ? filteredGroups : groups;
    return {
      all: base.length,
      public: base.filter((g) => g.type === "public").length,
      private: base.filter((g) => g.type === "private").length,
    };
  }, [groups, filteredGroups, search, filter, summary]);

  const handleDelete = async (group) => {
    if (
      !window.confirm(
        `Delete "${group.name}" and all chat messages? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(group.id);
    try {
      await deleteAdminWatchGroup(group.id);
      showToast("Watch group deleted.");
      if (activeGroup?.id === group.id) {
        setDetailOpen(false);
        setActiveGroup(null);
      }
      await loadGroups();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete watch group."));
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (group, tab = "messages") => {
    setActiveGroup(group);
    setDetailTab(tab);
    setDetailOpen(true);
    setDetailLoading(true);
    setMessages([]);
    setParticipants([]);
    try {
      const [msgRes, partRes] = await Promise.all([
        fetchAdminWatchMessages(group.id, { limit: 300 }),
        fetchAdminWatchParticipants(group.id),
      ]);
      setMessages(msgRes?.messages || []);
      setParticipants(partRes?.participants || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load group details."));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeGroup) return;
    setDeletingId(messageId);
    try {
      await deleteAdminWatchMessage(activeGroup.id, messageId);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
      showToast("Message removed.");
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to remove message."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemoveParticipant = async (memberId) => {
    if (!activeGroup) return;
    if (!window.confirm("Remove this participant?")) return;
    setDeletingId(memberId);
    try {
      await removeAdminWatchParticipant(activeGroup.id, memberId);
      setParticipants((prev) =>
        prev.filter((p) => String(p.id) !== String(memberId))
      );
      showToast("Participant removed.");
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to remove participant."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Watch Groups
          </h1>
          <p className="text-sm text-[#8C8070]">
            Moderate chat rooms — remove messages or participants, delete
            groups.
          </p>
        </div>
        <button
          type="button"
          onClick={loadGroups}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TYPE_FILTERS.map((item) => {
          const active = filter === item.id;
          const count =
            item.id === "all"
              ? counts.all
              : item.id === "public"
                ? counts.public
                : counts.private;
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
          placeholder="Search by name, owner, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading watch groups…
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
          <p>No watch groups found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredGroups.map((group) => {
            const isBusy = busyId === group.id;
            const isPrivate = group.type === "private";

            return (
              <article
                key={group.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 font-medium capitalize ${
                        isPrivate ? "text-[#D4AF37]" : "text-emerald-400"
                      }`}
                    >
                      {isPrivate ? <Lock size={11} /> : null}
                      {group.type}
                    </span>
                    <span>·</span>
                    <span>
                      Owner{" "}
                      {group.owner?.username || group.owner?.name || "unknown"}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(group.createdAt)}</span>
                  </div>

                  <h2 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
                    {group.name}
                  </h2>

                  <div className="flex items-center gap-3 text-[11px] text-[#8C8070]">
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} />
                      {group.participantCount}/{group.maxParticipants}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={11} />
                      {group.messageCount || 0} messages
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <ActionBtn
                    tone="primary"
                    onClick={() => openDetail(group, "messages")}
                  >
                    <MessageSquare size={12} />
                    Manage
                  </ActionBtn>
                  <ActionBtn
                    tone="danger"
                    disabled={isBusy}
                    onClick={() => handleDelete(group)}
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

      {detailOpen && activeGroup ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setDetailOpen(false)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#2A241E] shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#E5E0D8] truncate">
                  {activeGroup.name}
                </h2>
                <p className="text-[11px] text-[#8C8070] mt-0.5">
                  Moderate messages and participants
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1A1510] shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-1 p-1 mx-4 mt-3 rounded-xl bg-[#0E0C0A] border border-[#2A241E] shrink-0">
              {["messages", "participants"].map((tab) => {
                const active = detailTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      active
                        ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                        : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[200px]">
              {detailLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#A69B8D] gap-2">
                  <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
                  Loading…
                </div>
              ) : detailTab === "messages" ? (
                messages.length === 0 ? (
                  <p className="text-center text-[#8C8070] text-sm py-10">
                    No messages.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex gap-3 p-3 rounded-xl border border-[#2A241E] bg-[#0E0C0A]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-[#E5E0D8] truncate">
                            {msg.author?.name ||
                              msg.author?.username ||
                              "Member"}
                          </p>
                          <button
                            type="button"
                            disabled={deletingId === msg.id}
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="shrink-0 p-1 text-red-400/70 hover:text-red-400 disabled:opacity-50"
                          >
                            {deletingId === msg.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-[#A69B8D] mt-0.5 whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))
                )
              ) : participants.length === 0 ? (
                <p className="text-center text-[#8C8070] text-sm py-10">
                  No participants.
                </p>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#2A241E] bg-[#0E0C0A]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#E5E0D8] truncate">
                        {p.user?.name || p.user?.username || "Member"}
                      </p>
                      <p className="text-[10px] text-[#8C8070] capitalize mt-0.5">
                        {p.role}
                      </p>
                    </div>
                    {p.role !== "owner" ? (
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="shrink-0 p-1.5 text-red-400/70 hover:text-red-400 disabled:opacity-50"
                        title="Remove participant"
                      >
                        {deletingId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserMinus size={14} />
                        )}
                      </button>
                    ) : null}
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
