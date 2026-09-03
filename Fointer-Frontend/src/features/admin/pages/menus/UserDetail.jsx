import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuUsers as Users
} from 'react-icons/lu';
import { fetchAdminUserDetail } from '../../../../api/dashboard';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import ProfileAvatar from '../../../../shared/components/ProfileAvatar';

const cardClass =
  'bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5';
const innerItemClass =
  'rounded-lg border border-fo-border bg-fo-surface-hover p-3';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchAdminUserDetail(id);
      setDetail(data);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load user detail.');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/admin/users')}
        className="inline-flex items-center gap-1.5 text-xs text-fo-subtle hover:text-fo-accent transition-colors"
      >
        <ArrowLeft size={14} /> Back to users
      </button>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-fo-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading user detail...
        </div>
      ) : !detail?.user ? (
        <div className="border border-dashed border-fo-border rounded-xl py-12 text-center text-fo-subtle text-sm">
          User not found.
        </div>
      ) : (
        <div className="space-y-5">
          <div className={cardClass}>
            <div className="flex items-center gap-3">
              <ProfileAvatar
                src={detail.user.avatar}
                name={detail.user.name || detail.user.username}
                className="w-16 h-16 rounded-full object-cover border border-fo-border shrink-0"
              />
              <div className="min-w-0">
                <h1 className="font-serif text-2xl font-bold text-fo-text truncate">
                  {detail.user.name || detail.user.username}
                </h1>
                <p className="text-sm text-fo-muted">@{detail.user.username}</p>
                <p className="text-xs text-fo-subtle">{detail.user.email}</p>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4 text-fo-accent">
              <Users size={16} />
              <h2 className="font-semibold text-sm text-fo-text">Owned Communities</h2>
            </div>
            {detail.ownedCommunities?.length ? (
              <div className="space-y-3">
                {detail.ownedCommunities.map((community) => (
                  <div key={community.id} className={innerItemClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-fo-text">{community.name}</p>
                        <p className="text-[11px] text-fo-subtle">
                          @{community.owner?.username || detail.user.username}
                        </p>
                      </div>
                      <p className="text-xs text-fo-muted">
                        {community.memberCount || 0} members
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fo-subtle">No owned communities found.</p>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4 text-fo-accent">
              <Users size={16} />
              <h2 className="font-semibold text-sm text-fo-text">Marketplace Listings</h2>
            </div>
            {detail.listings?.length ? (
              <div className="space-y-3">
                {detail.listings.map((listing) => (
                  <div key={listing.id} className={innerItemClass}>
                    <p className="text-sm font-semibold text-fo-text truncate">
                      {listing.title}
                    </p>
                    <p className="text-[11px] text-fo-subtle mt-1">
                      {listing.status} · {listing.category} · ${listing.price}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fo-subtle">No marketplace listings.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
