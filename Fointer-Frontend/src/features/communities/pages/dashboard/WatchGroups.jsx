import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuLock as Lock,
  LuMessageCircle as MessageCircle,
  LuPlus as Plus,
  LuRadio as Radio,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuUsers as Users,
  LuX as X
} from "react-icons/lu";
import {
  createWatchGroup,
  fetchWatchGroups,
  joinWatchGroup,
} from "../../../../api/watchGroups";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../../context/AuthContext";
import { timeAgo } from "../../../../shared/utils/date";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
  { id: "joined", label: "Joined" },
];

const TYPE_OPTIONS = [
  { value: "public", label: "Public", hint: "Anyone can discover and join" },
  {
    value: "private",
    label: "Private",
    hint: "Invite-only — owner/moderator adds members",
  },
];

const emptyForm = {
  name: "",
  type: "public",
  maxParticipants: 50,
};

export default function WatchGroups() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWatchGroups();
      setGroups(res?.groups || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load watch groups.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      all: groups.length,
      public: groups.filter((g) => g.type === "public").length,
      private: groups.filter((g) => g.type === "private").length,
      joined: groups.filter((g) => g.isMember).length,
    };
  }, [groups]);

  const visibleGroups = useMemo(() => {
    let list = groups;
    if (filter === "public" || filter === "private") {
      list = list.filter((g) => g.type === filter);
    } else if (filter === "joined") {
      list = list.filter((g) => g.isMember);
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((g) => {
      const hay = [g.name, g.type, g.owner?.name, g.owner?.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [groups, filter, search]);

  const openModal = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/watch-groups" } });
      return;
    }
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/watch-groups" } });
      return;
    }
    if (!form.name.trim()) {
      showToast("Group name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createWatchGroup({
        name: form.name.trim(),
        type: form.type,
        maxParticipants: Number(form.maxParticipants) || 50,
      });
      showToast("Watch group created.");
      setModalOpen(false);
      const id = res?.group?.id || res?.group?.shortCode;
      if (id) navigate(`/watch-groups/${id}`);
      else load();
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to create watch group."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnter = async (group) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: `/watch-groups/${group.id}` },
      });
      return;
    }
    if (group.isMember) {
      navigate(`/watch-groups/${group.id}`);
      return;
    }
    if (!group.canJoin) {
      showToast(
        group.type === "private"
          ? "Private groups require an invite."
          : "Unable to join this group."
      );
      return;
    }

    setJoiningId(group.id);
    try {
      await joinWatchGroup(group.id);
      navigate(`/watch-groups/${group.id}`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to join watch group.");
    } finally {
      setJoiningId(null);
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
            Text chat rooms for watching and discussing together.
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
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a] transition-colors"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TYPE_FILTERS.map((item) => {
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
          placeholder="Search watch groups…"
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
      ) : visibleGroups.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-3">
          <Radio className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
          <p>
            {groups.length === 0
              ? "No watch groups yet."
              : "No groups match your search."}
          </p>
          {groups.length === 0 ? (
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
            >
              <Plus size={14} /> Create Watch Group
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleGroups.map((group) => {
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
                    {group.isMember ? (
                      <>
                        <span>·</span>
                        <span className="text-[#D4AF37]">Joined</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>
                      Owner{" "}
                      {group.owner?.username || group.owner?.name || "unknown"}
                    </span>
                    {group.createdAt ? (
                      <>
                        <span>·</span>
                        <span>{timeAgo(group.createdAt)}</span>
                      </>
                    ) : null}
                  </div>

                  <h2 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
                    {group.name}
                  </h2>

                  <p className="text-[11px] text-[#8C8070] inline-flex items-center gap-1">
                    <Users size={11} />
                    {group.participantCount}/{group.maxParticipants}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    joiningId === group.id ||
                    (!group.isMember && !group.canJoin)
                  }
                  onClick={() => handleEnter(group)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4AF37]/35 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/10 disabled:opacity-50 transition-colors"
                >
                  {joiningId === group.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <MessageCircle size={12} />
                  )}
                  {group.isMember
                    ? "Enter chat"
                    : group.canJoin
                      ? "Join & chat"
                      : group.type === "private"
                        ? "Invite only"
                        : "Full"}
                </button>
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
          <div className="relative w-full sm:max-w-md bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#E5E0D8]">
                Create Watch Group
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
                  Group name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  maxLength={100}
                  required
                  placeholder="e.g. Friday Night Match Chat"
                  className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 placeholder:text-[#5C5348]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                  Type
                </label>
                <div className="space-y-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, type: opt.value }))
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border transition-colors ${
                        form.type === opt.value
                          ? "border-[#D4AF37] bg-[#D4AF37]/10"
                          : "border-[#2A241E] hover:border-[#D4AF37]/40"
                      }`}
                    >
                      <span
                        className={
                          form.type === opt.value
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
                  Max participants
                </label>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={form.maxParticipants}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxParticipants: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
                />
                <p className="text-[10px] text-[#5C5348] mt-1">
                  Default 50 · maximum 200
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-1 bg-[#D4AF37] hover:bg-[#e0c04a] text-black font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Creating…
                  </>
                ) : (
                  "Create"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
