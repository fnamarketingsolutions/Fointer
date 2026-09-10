import { useEffect, useState } from "react";
import {
  LuLoaderCircle as Loader2,
  LuX as X,
} from "react-icons/lu";

export default function ApproveChannelRequestModal({
  open,
  ticket,
  channels = [],
  loading = false,
  onClose,
  onSubmit,
}) {
  const [mode, setMode] = useState("new");
  const [channelName, setChannelName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [subchannelName, setSubchannelName] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(channels.length ? "existing" : "new");
    setChannelName("");
    setChannelId(channels[0]?.id ? String(channels[0].id) : "");
    setSubchannelName("");
  }, [open, channels]);

  if (!open || !ticket) return null;

  const canSubmit =
    Boolean(subchannelName.trim()) &&
    (mode === "new" ? Boolean(channelName.trim()) : Boolean(channelId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    await onSubmit({
      channelId: mode === "existing" ? channelId : undefined,
      channelName: mode === "new" ? channelName.trim() : undefined,
      subchannelName: subchannelName.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-[480px] bg-[#120F0D] border border-fo-border rounded-2xl p-6 space-y-5 shadow-2xl text-fo-text">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-serif font-semibold text-fo-text">
              Create & approve
            </h3>
            <p className="text-[11px] text-fo-muted mt-0.5">
              Channel and subchannel must be created before this request can be approved.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-fo-subtle hover:text-fo-text p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl border border-fo-border bg-fo-bg px-4 py-3 text-xs text-fo-muted leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap break-words">
          {ticket.description}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border">
            <button
              type="button"
              disabled={loading}
              onClick={() => setMode("new")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                mode === "new"
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              New channel
            </button>
            <button
              type="button"
              disabled={loading || channels.length === 0}
              onClick={() => setMode("existing")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                mode === "existing"
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              Existing channel
            </button>
          </div>

          {mode === "new" ? (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                Channel name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. Sports"
                maxLength={80}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg bg-fo-bg border border-fo-border text-sm text-fo-text placeholder-[#5A5046] focus:outline-none focus:border-fo-accent/80"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                Parent channel
              </label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-fo-bg border border-fo-border text-sm text-fo-text focus:outline-none focus:border-fo-accent/80"
              >
                <option value="">Select a channel</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
              Subchannel name
            </label>
            <input
              type="text"
              value={subchannelName}
              onChange={(e) => setSubchannelName(e.target.value)}
              placeholder="e.g. Cricket"
              maxLength={80}
              className="w-full px-3.5 py-2.5 rounded-lg bg-fo-bg border border-fo-border text-sm text-fo-text placeholder-[#5A5046] focus:outline-none focus:border-fo-accent/80"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-xs font-semibold text-black disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Create & approve
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
