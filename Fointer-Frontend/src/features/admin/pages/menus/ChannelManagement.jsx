import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LuHash as Hash,
  LuLayers as Layers,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuSearch as Search
} from "react-icons/lu";
import {
  createAdminChannel,
  createAdminSubchannel,
  fetchAdminChannels,
  fetchAdminSubchannels,
  updateAdminChannel,
  updateAdminSubchannel,
} from "../../services/adminService";
import CreateChannelModal from "../../../../shared/components/modals/CreateChannelModal";
import CreateSubchannelModal from "../../../../shared/components/modals/CreateSubchannelModal";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const TABS = [
  { id: "channels", label: "Channels" },
  { id: "subchannels", label: "Subchannels" },
];

export default function ChannelManagement() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab =
    searchParams.get("tab") === "subchannels" ? "subchannels" : "channels";

  const [channels, setChannels] = useState([]);
  const [subchannels, setSubchannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) setSearch(q);
  }, [searchParams]);

  const setTab = (nextTab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "subchannels") next.set("tab", "subchannels");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelData, subData] = await Promise.all([
        fetchAdminChannels(),
        fetchAdminSubchannels(),
      ]);
      setChannels(channelData?.channels || []);
      setSubchannels(subData?.subchannels || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load channels."));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const query = search.trim().toLowerCase();

  const filteredChannels = useMemo(() => {
    if (!query) return channels;
    return channels.filter((c) => (c.name || "").toLowerCase().includes(query));
  }, [channels, query]);

  const filteredSubchannels = useMemo(() => {
    const channelIdFilter = searchParams.get("channelId");
    return subchannels.filter((s) => {
      if (channelIdFilter && String(s.channel?.id) !== String(channelIdFilter)) {
        return false;
      }
      if (!query) return true;
      return (
        (s.name || "").toLowerCase().includes(query) ||
        (s.channel?.name || "").toLowerCase().includes(query)
      );
    });
  }, [subchannels, query, searchParams]);

  const handleCreateChannel = async ({ name }) => {
    setCreating(true);
    try {
      await createAdminChannel({ name });
      setCreateChannelOpen(false);
      showToast("Channel created.");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create channel."));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateChannel = async ({ name }) => {
    if (!editingChannel?.id) return;
    setCreating(true);
    try {
      await updateAdminChannel(editingChannel.id, { name });
      setEditingChannel(null);
      showToast("Channel updated.");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update channel."));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSubchannel = async ({ name, channelId }) => {
    setCreating(true);
    try {
      await createAdminSubchannel({ name, channelId });
      setCreateSubOpen(false);
      showToast("Subchannel created.");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create subchannel."));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateSubchannel = async ({ name, channelId }) => {
    if (!editingSub?.id) return;
    setCreating(true);
    try {
      await updateAdminSubchannel(editingSub.id, { name, channelId });
      setEditingSub(null);
      showToast("Subchannel updated.");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update subchannel."));
    } finally {
      setCreating(false);
    }
  };

  const isChannels = tab === "channels";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Channels
          </h1>
          <p className="text-sm text-[#8C8070]">
            Manage channels and subchannels used when creating communities.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {isChannels ? (
            <button
              type="button"
              onClick={() => setCreateChannelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]"
            >
              <Plus size={14} />
              Create
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCreateSubOpen(true)}
              disabled={channels.length === 0}
              title={
                channels.length === 0
                  ? "Create a channel first"
                  : "Create subchannel"
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a] disabled:opacity-50"
            >
              <Plus size={14} />
              Create
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E]">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count =
            t.id === "channels" ? channels.length : subchannels.length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {t.label}
              {!loading ? (
                <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
              ) : null}
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
          placeholder={
            isChannels
              ? "Search by channel name…"
              : "Search by subchannel or channel…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading…
        </div>
      ) : isChannels ? (
        channels.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-3">
            <p>No channels yet. Create one to get started.</p>
            <button
              type="button"
              onClick={() => setCreateChannelOpen(true)}
              className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
            >
              <Plus size={14} /> Create channel
            </button>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
            No channels match your search.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredChannels.map((channel) => (
              <article
                key={channel.id}
                className="flex items-center gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#1A1510] border border-[#2A241E] flex items-center justify-center shrink-0">
                  <Hash size={16} className="text-[#D4AF37]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[#E5E0D8] truncate">
                    {channel.name}
                  </h2>
                  <p className="text-[11px] text-[#8C8070] mt-0.5">
                    {channel.createdAt
                      ? `Created ${timeAgo(channel.createdAt)}`
                      : "Channel"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingChannel(channel)}
                  className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors shrink-0"
                  title="Edit channel"
                >
                  <Pencil size={14} />
                </button>
              </article>
            ))}
          </div>
        )
      ) : channels.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4">
          Create a channel first, then add subchannels.
        </div>
      ) : subchannels.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-3">
          <p>No subchannels yet. Create one to get started.</p>
          <button
            type="button"
            onClick={() => setCreateSubOpen(true)}
            className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
          >
            <Plus size={14} /> Create subchannel
          </button>
        </div>
      ) : filteredSubchannels.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
          No subchannels match your search.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSubchannels.map((sub) => (
            <article
              key={sub.id}
              className="flex items-center gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1A1510] border border-[#2A241E] flex items-center justify-center shrink-0">
                <Layers size={16} className="text-[#D4AF37]" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-sm font-semibold text-[#E5E0D8] truncate">
                  {sub.name}
                </h2>
                <p className="text-[11px] text-[#8C8070]">
                  {sub.channel?.name || "Unassigned"}
                  {sub.createdAt ? ` · ${timeAgo(sub.createdAt)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSub(sub)}
                className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors shrink-0"
                title="Edit subchannel"
              >
                <Pencil size={14} />
              </button>
            </article>
          ))}
        </div>
      )}

      <CreateChannelModal
        open={createChannelOpen || Boolean(editingChannel)}
        channel={editingChannel}
        onClose={() => {
          if (creating) return;
          setCreateChannelOpen(false);
          setEditingChannel(null);
        }}
        onSubmit={editingChannel ? handleUpdateChannel : handleCreateChannel}
        loading={creating}
      />

      <CreateSubchannelModal
        open={createSubOpen || Boolean(editingSub)}
        subchannel={editingSub}
        onClose={() => {
          if (creating) return;
          setCreateSubOpen(false);
          setEditingSub(null);
        }}
        onSubmit={editingSub ? handleUpdateSubchannel : handleCreateSubchannel}
        channels={channels}
        loading={creating}
      />
    </div>
  );
}
