import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LuArrowLeft as ArrowLeft,
  LuBan as Ban,
  LuChevronRight as ChevronRight,
  LuCircleCheck as CheckCircle2,
  LuLoaderCircle as Loader2,
  LuShoppingBag as ShoppingBag,
  LuTriangleAlert as AlertTriangle,
  LuUsers as Users,
} from 'react-icons/lu';
import {
  fetchAdminUserDetail,
  updateUserStatus,
  createAdminWarning,
  fetchWarningPolicy,
} from '../../../../api/dashboard';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import AdminActionBtn from '../../../../shared/components/AdminActionBtn';
import WarnUserModal from '../../../../shared/components/modals/WarnUserModal';
import ProfileAvatar from '../../../../shared/components/ProfileAvatar';
import { isSuperAdminUser } from '../../../../shared/lib/roles';
import { communitySegment } from '../../../../shared/services/entityLinks';
import { formatCommunityType } from '../../../../shared/utils/community';
import { formatLongDate } from '../../../../shared/utils/date';
import {
  categoryLabel,
  formatPrice,
  statusLabel,
} from '../../../marketplace/constants';

const cardClass =
  'bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5';
const innerItemClass =
  'rounded-lg border border-fo-border bg-fo-surface-hover p-3';
const rowBtnClass = `${innerItemClass} w-full text-left hover:border-fo-accent/40 hover:bg-fo-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40`;

const statusMeta = (status) => {
  if (status === 'banned') {
    return { label: 'Banned', className: 'text-red-400' };
  }
  if (status === 'suspended') {
    return { label: 'Suspended', className: 'text-amber-400' };
  }
  return { label: 'Active', className: 'text-emerald-400' };
};

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnPolicy, setWarnPolicy] = useState({
    maxWarningsBeforeBan: 3,
    autoBanOnMaxWarnings: true,
  });

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

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminUserDetail(id);
      setDetail(data);
    } catch (err) {
      setDetail(null);
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || 'Failed to load user detail.';
      if (status === 404) {
        setLoadError(null);
      } else {
        setLoadError(message);
        showToast(message);
      }
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const user = detail?.user;
  const isSelf =
    user &&
    String(user.id) === String(currentUser?.id || currentUser?._id);
  const targetIsAdmin =
    String(user?.role || '')
      .toLowerCase()
      .trim() === 'admin';
  const canModerateStatus =
    Boolean(user) &&
    (!targetIsAdmin || Boolean(isSuperAdmin || isSuperAdminUser(currentUser)));

  const setStatus = async (status) => {
    if (!user?.id) return;
    if (isSelf && status !== 'active') {
      showToast('You cannot ban your own account.');
      return;
    }
    if (targetIsAdmin && !(isSuperAdmin || isSuperAdminUser(currentUser))) {
      showToast("Only a super admin can change another admin's status.");
      return;
    }
    setBusy(true);
    try {
      await updateUserStatus(user.id, status);
      showToast(status === 'banned' ? 'User banned.' : 'User activated.');
      await loadDetail();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status.');
    } finally {
      setBusy(false);
    }
  };

  const submitWarn = async (message) => {
    if (!user?.id) return;
    setWarnSaving(true);
    try {
      const data = await createAdminWarning({
        userId: user.id,
        message,
        source: 'admin_panel',
      });
      showToast(data?.message || 'Warning issued.');
      setWarnOpen(false);
      await loadDetail();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to issue warning.');
    } finally {
      setWarnSaving(false);
    }
  };

  const communityCount =
    detail?.communityCount ?? detail?.ownedCommunities?.length ?? 0;
  const listingCount = detail?.listingCount ?? detail?.listings?.length ?? 0;
  const status = statusMeta(user?.status);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/users')}
        className="inline-flex items-center gap-2 min-h-10 px-1 text-sm text-fo-subtle hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
      >
        <ArrowLeft size={16} /> Back to users
      </button>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-fo-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-fo-accent" />
          Loading user detail...
        </div>
      ) : loadError ? (
        <div className="border border-dashed border-fo-border rounded-xl py-12 px-4 text-center space-y-3">
          <p className="text-sm text-fo-text font-medium">Could not load user</p>
          <p className="text-xs text-fo-subtle">{loadError}</p>
          <button
            type="button"
            onClick={loadDetail}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            Retry
          </button>
        </div>
      ) : !user ? (
        <div className="border border-dashed border-fo-border rounded-xl py-12 text-center text-fo-subtle text-sm">
          User not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <ProfileAvatar
                  src={user.avatar}
                  name={user.name || user.username}
                  className="w-16 h-16 rounded-full object-cover border border-fo-border shrink-0"
                />
                <div className="min-w-0 space-y-1.5">
                  <h1 className="text-xl sm:text-2xl font-semibold text-fo-text truncate">
                    {user.name || user.username}
                  </h1>
                  <p className="text-sm text-fo-muted">@{user.username}</p>
                  {user.email ? (
                    <p className="text-xs text-fo-subtle break-all">
                      {user.email}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-xs uppercase tracking-wide text-fo-subtle">
                      {user.role || 'user'}
                    </span>
                    <span
                      className={`text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {(user.warningCount || 0) > 0 ? (
                      <span className="text-xs font-medium text-amber-400">
                        {user.warningCount} warn
                        {user.warningCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-fo-subtle">
                    Joined {formatLongDate(user.createdAt)}
                    <span className="text-fo-border mx-1.5">·</span>
                    {communityCount} communit
                    {communityCount === 1 ? 'y' : 'ies'}
                    <span className="text-fo-border mx-1.5">·</span>
                    {listingCount} listing{listingCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {canModerateStatus ? (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {user.status !== 'banned' ? (
                    <AdminActionBtn
                      disabled={busy || isSelf}
                      onClick={() => setWarnOpen(true)}
                    >
                      <AlertTriangle size={12} />
                      Warn
                    </AdminActionBtn>
                  ) : null}
                  {user.status !== 'banned' ? (
                    <AdminActionBtn
                      tone="danger"
                      disabled={busy || isSelf}
                      onClick={() => setStatus('banned')}
                    >
                      {busy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Ban size={12} />
                      )}
                      Ban
                    </AdminActionBtn>
                  ) : null}
                  {user.status !== 'active' ? (
                    <AdminActionBtn
                      tone="success"
                      disabled={busy}
                      onClick={() => setStatus('active')}
                    >
                      {busy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      Activate
                    </AdminActionBtn>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-4 text-fo-accent">
                <Users size={16} />
                <h2 className="font-semibold text-sm text-fo-text">
                  Owned Communities
                  <span className="text-fo-muted font-normal">
                    {' '}
                    ({communityCount})
                  </span>
                </h2>
              </div>
              {detail.ownedCommunities?.length ? (
                <div className="space-y-2.5">
                  {detail.ownedCommunities.map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() =>
                        navigate(`/communities/${communitySegment(community)}`)
                      }
                      className={rowBtnClass}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fo-text truncate">
                            {community.name}
                          </p>
                          <p className="text-xs text-fo-subtle mt-0.5">
                            {formatCommunityType(community.type)}
                            <span className="mx-1">·</span>
                            {community.memberCount || 0} members
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-fo-subtle shrink-0"
                          aria-hidden
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fo-subtle">
                  No owned communities. Communities this user creates will show
                  here.
                </p>
              )}
            </div>

            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-4 text-fo-accent">
                <ShoppingBag size={16} />
                <h2 className="font-semibold text-sm text-fo-text">
                  Marketplace Listings
                  <span className="text-fo-muted font-normal">
                    {' '}
                    ({listingCount})
                  </span>
                </h2>
              </div>
              {detail.listings?.length ? (
                <div className="space-y-2.5">
                  {detail.listings.map((listing) => (
                    <button
                      key={listing.id}
                      type="button"
                      onClick={() => navigate(`/marketplace/${listing.id}`)}
                      className={rowBtnClass}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fo-text truncate">
                            {listing.title}
                          </p>
                          <p className="text-xs text-fo-subtle mt-0.5 truncate">
                            {statusLabel(listing.status)}
                            <span className="mx-1">·</span>
                            {categoryLabel(listing.category)}
                            <span className="mx-1">·</span>
                            {formatPrice(
                              listing.price,
                              listing.currency || 'USD'
                            )}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-fo-subtle shrink-0"
                          aria-hidden
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fo-subtle">
                  No marketplace listings for this user.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <WarnUserModal
        open={warnOpen}
        user={user}
        warningCount={user?.warningCount || 0}
        maxWarningsBeforeBan={warnPolicy.maxWarningsBeforeBan}
        autoBanOnMaxWarnings={warnPolicy.autoBanOnMaxWarnings}
        loading={warnSaving}
        onClose={() => !warnSaving && setWarnOpen(false)}
        onSubmit={submitWarn}
      />
    </div>
  );
}