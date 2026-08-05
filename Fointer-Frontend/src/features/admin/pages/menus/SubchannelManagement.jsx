import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import {
  fetchAdminChannels,
  fetchAdminSubchannels,
  createAdminSubchannel,
} from '../../services/adminService';
import CreateSubchannelModal from '../../../../shared/components/modals/CreateSubchannelModal';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { formatDate } from '../../../../shared/utils/date';

export default function SubchannelManagement() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [subchannels, setSubchannels] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? subchannels.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(query) ||
          (s.channel?.name || '').toLowerCase().includes(query)
      )
    : subchannels;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subData, channelData] = await Promise.all([
        fetchAdminSubchannels(),
        fetchAdminChannels(),
      ]);
      setSubchannels(subData?.subchannels || []);
      setChannels(channelData?.channels || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load subchannels.'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async ({ name, channelId }) => {
    setCreating(true);
    try {
      await createAdminSubchannel({ name, channelId });
      setCreateOpen(false);
      showToast('Subchannel created.');
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create subchannel.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
            Subchannels
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Create subchannels under a parent channel. Names are unique within each channel.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={channels.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-xs font-semibold text-[#130d08] disabled:opacity-50"
            title={channels.length === 0 ? 'Create a channel first' : 'Create subchannel'}
          >
            <Plus size={14} />
            Create Subchannel
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
        <input
          type="text"
          placeholder="Search by subchannel or channel name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141210] border border-stone-800/60 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600/50 placeholder:text-stone-600"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading subchannels...
        </div>
      ) : channels.length === 0 ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          Create a channel first, then add subchannels.
        </div>
      ) : subchannels.length === 0 ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          No subchannels yet. Create one to get started.
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          No subchannels match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div
            key={sub.id}
            className="relative flex flex-col justify-between w-full rounded-xl p-2 pt-8 bg-gradient-to-br from-[#1b1713] via-[#141210] to-[#0d0b0a] border border-stone-800/70 hover:border-amber-500/30 transition-all duration-200 shadow-sm overflow-hidden"
          >
            {/* Top-Left Channel Badge/Strip */}
            <div className="absolute top-0 left-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-br-lg bg-amber-500/15 border-b border-r border-amber-500/30 text-[10px] font-semibold tracking-wider uppercase text-amber-400">
                {sub.channel?.name || 'Unassigned'}
              </span>
            </div>
          
            {/* Top-Right Creation Time */}
            {sub.createdAt && (
              <div className="absolute top-2 right-3">
                <span className="text-[11px] text-gray-200 whitespace-nowrap">
                  {formatDate(sub.createdAt)}
                </span>
              </div>
            )}
          
            {/* Main Content (Sub-channel Name) */}
            <div className="mt-1">
              <p className="font-serif text-sm font-medium text-amber-50 break-words">
                {sub.name}
              </p>
            </div>
          </div>
          ))}
        </div>
      )}

      <CreateSubchannelModal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        onSubmit={handleCreate}
        channels={channels}
        loading={creating}
      />
    </div>
  );
}
