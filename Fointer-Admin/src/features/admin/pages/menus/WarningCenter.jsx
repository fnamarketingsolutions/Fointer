import { useCallback, useEffect, useState } from 'react';
import {
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuTriangleAlert as AlertTriangle,
} from 'react-icons/lu';
import {
  createAdminWarning,
  fetchAdminWarnings,
} from '../../services/adminService';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import WarnUserModal from '../../../../shared/components/modals/WarnUserModal';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { timeAgo } from '../../../../shared/utils/date';

export default function WarningCenter() {
  const { showToast } = useToast();
  const [warnings, setWarnings] = useState([]);
  const [policy, setPolicy] = useState({
    maxWarningsBeforeBan: 3,
    autoBanOnMaxWarnings: true,
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [warnTarget, setWarnTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (opts = {}) => {
      const nextSearch = opts.search ?? search;
      setLoading(true);
      try {
        const data = await fetchAdminWarnings(
          nextSearch.trim() ? { q: nextSearch.trim() } : {}
        );
        setWarnings(data?.warnings || []);
        if (data?.policy) setPolicy(data.policy);
      } catch (err) {
        showToast(getErrorMessage(err, 'Failed to load warnings.'));
      } finally {
        setLoading(false);
      }
    },
    [search, showToast]
  );

  useEffect(() => {
    load({ search: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load({ search });
  };

  const submitWarn = async (message) => {
    if (!warnTarget?.id) return;
    setSaving(true);
    try {
      const data = await createAdminWarning({
        userId: warnTarget.id,
        message,
        source: 'admin_panel',
      });
      showToast(data?.message || 'Warning issued.');
      setWarnTarget(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to issue warning.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text flex items-center gap-2">
            <AlertTriangle className="text-amber-400" size={22} />
            Warnings
          </h1>
          <p className="text-sm text-fo-subtle">
            Limit {policy.maxWarningsBeforeBan} · Auto-ban{' '}
            {policy.autoBanOnMaxWarnings ? 'on' : 'off'} · configure in System
            Settings
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <form onSubmit={handleSearch} className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by user or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading warnings…
        </div>
      ) : warnings.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No warnings yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {warnings.map((w) => (
            <article
              key={w.id}
              className={`rounded-xl border p-3.5 sm:p-4 space-y-2 ${
                w.resultedInBan
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-amber-500/35 bg-amber-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fo-text truncate">
                    {w.user?.name || w.user?.username || 'Unknown user'}
                    {w.user?.username ? (
                      <span className="text-fo-subtle font-normal">
                        {' '}
                        @{w.user.username}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-fo-subtle mt-0.5">
                    By {w.issuedBy?.name || w.issuedBy?.username || 'admin'}
                    {' · '}
                    {w.source}
                    {' · '}
                    {timeAgo(w.createdAt)}
                    {w.user?.warningCount != null
                      ? ` · ${w.user.warningCount} total`
                      : ''}
                  </p>
                </div>
                {w.resultedInBan ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400 shrink-0">
                    Led to ban
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300 shrink-0">
                    Warning
                  </span>
                )}
              </div>
              <p className="text-sm text-fo-text whitespace-pre-wrap leading-relaxed">
                {w.message}
              </p>
              {w.user?.id && w.user?.status !== 'banned' ? (
                <button
                  type="button"
                  onClick={() =>
                    setWarnTarget({
                      id: w.user.id,
                      name: w.user.name,
                      username: w.user.username,
                      email: w.user.email,
                      warningCount: w.user.warningCount || 0,
                    })
                  }
                  className="text-xs font-medium text-amber-300 hover:underline"
                >
                  Warn again
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <WarnUserModal
        open={Boolean(warnTarget)}
        user={warnTarget}
        warningCount={warnTarget?.warningCount || 0}
        maxWarningsBeforeBan={policy.maxWarningsBeforeBan}
        autoBanOnMaxWarnings={policy.autoBanOnMaxWarnings}
        loading={saving}
        onClose={() => !saving && setWarnTarget(null)}
        onSubmit={submitWarn}
      />
    </div>
  );
}
