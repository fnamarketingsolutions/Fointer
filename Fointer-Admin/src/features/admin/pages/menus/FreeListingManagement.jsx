import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuGift as Gift,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuRefreshCw as RefreshCw,
  LuRotateCcw as RotateCcw,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuTriangleAlert as AlertTriangle,
} from 'react-icons/lu';
import {
  fetchAdminFreeListings,
  fetchWarningPolicy,
  removeAdminFreeListing,
  restoreAdminFreeListing,
  warnAdminFreeListingSeller,
} from '../../../../api/dashboard';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import AdminActionBtn from '../../../../shared/components/AdminActionBtn';
import WarnUserModal from '../../../../shared/components/modals/WarnUserModal';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { timeAgo } from '../../../../shared/utils/date';
import { formatListingPrice } from '../../../marketplace/constants';

const STATUS_FILTERS = ['all', 'active', 'sold', 'draft', 'hidden', 'removed'];

export default function FreeListingManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnPolicy, setWarnPolicy] = useState({
    maxWarningsBeforeBan: 3,
    autoBanOnMaxWarnings: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminFreeListings({
        status: status === 'all' ? undefined : status,
        q: query.trim() || undefined,
        reported: reportedOnly ? 'true' : undefined,
      });
      setListings(data?.listings || []);
      setSummary(data?.summary || {});
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to load free listings.'));
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [query, reportedOnly, showToast, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    fetchWarningPolicy()
      .then((data) => {
        if (!data?.policy) return;
        setWarnPolicy({
          maxWarningsBeforeBan: data.policy.maxWarningsBeforeBan ?? 3,
          autoBanOnMaxWarnings: data.policy.autoBanOnMaxWarnings !== false,
        });
      })
      .catch(() => {});
  }, []);

  const handleStatusChange = async (listing, nextStatus) => {
    if (
      nextStatus === 'removed' &&
      !window.confirm(`Remove "${listing.title}" from Free Listings?`)
    ) {
      return;
    }
    const action = nextStatus === 'active' ? restoreAdminFreeListing : removeAdminFreeListing;
    setBusyId(listing.id);
    try {
      await action(listing.id);
      showToast(nextStatus === 'active' ? 'Free listing restored.' : 'Free listing removed.');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to update free listing.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleWarn = async (message) => {
    if (!warnTarget?.id) return;
    setWarnSaving(true);
    try {
      const result = await warnAdminFreeListingSeller(warnTarget.id, {
        message: message.trim(),
      });
      showToast(result?.message || 'Warning sent.');
      setWarnTarget(null);
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to warn seller.'));
    } finally {
      setWarnSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text flex items-center gap-2">
            <Gift size={20} className="text-fo-accent" />
            Free Listings
          </h1>
          <p className="text-sm text-fo-subtle mt-1">
            Review, edit, remove, and restore free listings separately from Marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
          aria-label="Refresh free listings"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search free listings..."
            className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-fo-border text-xs text-fo-muted">
          <input
            type="checkbox"
            checked={reportedOnly}
            onChange={(event) => setReportedOnly(event.target.checked)}
          />
          Reported only
        </label>
      </form>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
              status === value
                ? 'bg-[#1A1510] text-fo-accent border border-fo-accent/35'
                : 'text-fo-subtle'
            }`}
          >
            {value} {summary[value] != null ? `(${summary[value]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 size={18} className="animate-spin text-fo-accent" />
        </div>
      ) : listings.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No free listings found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {listings.map((listing) => (
            <article key={listing.id} className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fo-text truncate">{listing.title}</p>
                  <p className="text-xs text-fo-accent font-semibold">{formatListingPrice(listing)}</p>
                  <p className="text-[11px] text-fo-subtle mt-1">
                    {listing.status} · {listing.seller?.username || 'seller'}
                    {listing.pendingReports > 0 ? ` · ${listing.pendingReports} report(s)` : ''}
                    {' · '}{timeAgo(listing.createdAt)}
                  </p>
                </div>
                {listing.media?.[0]?.url ? (
                  <img src={listing.media[0].url} alt="" className="w-14 h-14 rounded-lg object-cover border border-fo-border shrink-0" />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <AdminActionBtn onClick={() => navigate(`/freelistings/${listing.shortCode || listing.id}?edit=1`)}>
                  <Pencil size={12} /> Edit
                </AdminActionBtn>
                {listing.status !== 'removed' ? (
                  <AdminActionBtn
                    tone="danger"
                    disabled={busyId === listing.id}
                    onClick={() => handleStatusChange(listing, 'removed')}
                  >
                    <Trash2 size={12} /> Remove
                  </AdminActionBtn>
                ) : null}
                {listing.status === 'removed' || listing.status === 'hidden' ? (
                  <AdminActionBtn
                    disabled={busyId === listing.id}
                    onClick={() => handleStatusChange(listing, 'active')}
                  >
                    <RotateCcw size={12} /> Restore
                  </AdminActionBtn>
                ) : null}
                <AdminActionBtn
                  onClick={() => setWarnTarget({
                    id: listing.id,
                    name: listing.seller?.name || listing.seller?.username || 'Seller',
                    username: listing.seller?.username || '',
                    warningCount: listing.seller?.warningCount || 0,
                  })}
                >
                  <AlertTriangle size={12} /> Warn seller
                </AdminActionBtn>
                <AdminActionBtn tone="primary" onClick={() => navigate(`/freelistings/${listing.shortCode || listing.id}`)}>
                  View
                </AdminActionBtn>
              </div>
            </article>
          ))}
        </div>
      )}

      <WarnUserModal
        open={Boolean(warnTarget)}
        user={warnTarget}
        loading={warnSaving}
        warningCount={warnTarget?.warningCount || 0}
        maxWarningsBeforeBan={warnPolicy.maxWarningsBeforeBan}
        autoBanOnMaxWarnings={warnPolicy.autoBanOnMaxWarnings}
        onClose={() => {
          if (!warnSaving) setWarnTarget(null);
        }}
        onSubmit={handleWarn}
      />
    </div>
  );
}
