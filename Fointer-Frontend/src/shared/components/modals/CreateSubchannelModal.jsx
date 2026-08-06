import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

export default function CreateSubchannelModal({
  open,
  onClose,
  onSubmit,
  channels = [],
  loading = false,
}) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setChannelId(channels[0]?.id || '');
    }
  }, [open, channels]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !channelId || loading) return;
    await onSubmit({ name: name.trim(), channelId });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] bg-[#120D0B] border border-stone-800/60 rounded-2xl p-6 space-y-5 shadow-2xl text-stone-300">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medium text-amber-50">Create Subchannel</h3>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">
              Parent channel
            </label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2.5 text-sm text-stone-200 focus:outline-none focus:border-amber-600/50"
            >
              <option value="">Select a channel</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">
              Subchannel name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cricket"
              className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2.5 text-sm text-stone-200 focus:outline-none focus:border-amber-600/50 placeholder:text-stone-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-stone-800 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !channelId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-xs font-semibold text-[#130d08] disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
