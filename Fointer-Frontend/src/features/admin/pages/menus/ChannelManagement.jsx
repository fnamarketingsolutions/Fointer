import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Search, Hash, Calendar } from 'lucide-react';
import {
  fetchAdminChannels,
  createAdminChannel,
} from '../../services/adminService';
import CreateChannelModal from '../../../../shared/components/modals/CreateChannelModal';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { formatDate } from '../../../../shared/utils/date';

export default function ChannelManagement() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
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
    ? channels.filter((c) => (c.name || '').toLowerCase().includes(query))
    : channels;

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminChannels();
      setChannels(data?.channels || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load channels.'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleCreate = async ({ name }) => {
    setCreating(true);
    try {
      await createAdminChannel({ name });
      setCreateOpen(false);
      showToast('Channel created.');
      await loadChannels();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create channel.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
            Channels
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage unique channel names used when users create communities.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadChannels}
            disabled={loading}
            className="p-2 rounded-lg border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-xs font-semibold text-[#130d08] hover:brightness-110 transition-all"
          >
            <Plus size={14} />
            Create Channel
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
        <input
          type="text"
          placeholder="Search by channel name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141210] border border-stone-800/60 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600/50 placeholder:text-stone-600 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          Loading channels...
        </div>
      ) : channels.length === 0 ? (
        <div className="border border-dashed border-stone-800/80 rounded-xl py-12 text-center text-stone-500 text-sm">
          No channels yet. Create one to get started.
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-stone-800/80 rounded-xl py-12 text-center text-stone-500 text-sm">
          No channels match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((channel) => (
            <div
              key={channel.id}
              className="flex flex-col justify-between rounded-xl p-4 bg-gradient-to-br from-[#141210]/80 to-[#F8A201]/30 border border-stone-800/70 hover:border-amber-500/30 transition-all duration-200 shadow-sm hover:shadow-md group"
            >
              <div>

                <h3 className="font-serif text-base font-medium text-amber-50 break-words line-clamp-2">
                  {channel.name}
                  
                </h3>
              </div>

              {channel.createdAt && (
                <div className="mt-4 pt-3 border-t border-stone-800/50 flex items-center gap-1.5 text-[11px] text-gray-300">
                  <Calendar size={12} className="text-gray-300 shrink-0" />
                  <span>Created {formatDate(channel.createdAt)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateChannelModal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
      />
    </div>
  );
}