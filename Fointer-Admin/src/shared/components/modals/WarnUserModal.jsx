import { useEffect, useState } from 'react';
import {
  LuLoaderCircle as Loader2,
  LuTriangleAlert as AlertTriangle,
  LuX as X,
} from 'react-icons/lu';

const inputClass =
  'w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle';

/**
 * Modal to issue a written platform warning before (or instead of) a ban.
 */
export default function WarnUserModal({
  open,
  user = null,
  loading = false,
  warningCount = 0,
  maxWarningsBeforeBan = 3,
  autoBanOnMaxWarnings = true,
  onClose,
  onSubmit,
}) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) setMessage('');
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const nextCount = (warningCount || 0) + 1;
  const willAutoBan =
    autoBanOnMaxWarnings && nextCount >= Number(maxWarningsBeforeBan || 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    await onSubmit(message.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--theme-overlay)] backdrop-blur-sm">
      <div className="relative w-full max-w-[480px] bg-fo-surface border border-fo-border rounded-2xl p-6 space-y-5 shadow-2xl text-fo-text">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-medium text-fo-text flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-400" />
              Warn user
            </h3>
            {user ? (
              <p className="text-xs text-fo-subtle mt-1 truncate">
                {user.name || user.username}
                {user.email ? ` · ${user.email}` : ''}
              </p>
            ) : null}
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

        <div className="rounded-lg border border-amber-600/35 bg-amber-500/15 px-3 py-2 text-xs text-fo-text">
          Current warnings: {warningCount || 0} / {maxWarningsBeforeBan || 3}
          {willAutoBan
            ? ' · This warning will auto-ban the account.'
            : autoBanOnMaxWarnings
              ? ` · Auto-ban at ${maxWarningsBeforeBan || 3} warnings.`
              : ' · Auto-ban is off; ban manually if needed.'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
              Warning message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              required
              autoFocus
              placeholder="Explain the policy violation clearly…"
              className={`${inputClass} resize-y min-h-[120px]`}
            />
            <p className="mt-1 text-[11px] text-fo-subtle">
              {message.length}/2000 · User and admins will be notified.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-text disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-600/45 text-fo-text text-xs font-semibold disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {willAutoBan ? 'Warn & ban' : 'Send warning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
