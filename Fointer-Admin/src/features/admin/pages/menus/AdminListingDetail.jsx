import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuMapPin as MapPin,
  LuPencil as Pencil,
  LuX as X,
} from 'react-icons/lu';
import {
  fetchAdminMarketplaceListing,
  updateAdminMarketplaceListing,
} from '../../services/adminService';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import MediaPicker from '../../../../shared/components/media/MediaPicker';
import AdminUserLink from '../../../../shared/components/AdminUserLink';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { timeAgo } from '../../../../shared/utils/date';
import {
  LISTING_STATUSES,
  categoryLabel,
  conditionLabel,
  formatLocation,
  formatPrice,
  statusLabel,
} from '../../../marketplace/constants';

const inputClass =
  'w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50';

export default function AdminListingDetail() {
  const { listingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminMarketplaceListing(listingId);
      setListing(data?.listing || null);
      setActiveMedia(0);
    } catch (err) {
      showToast(getErrorMessage(err, 'Listing not found.'));
      navigate('/marketplace', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [listingId, navigate, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const buildEditForm = (item) => ({
    title: item.title || '',
    description: item.description || '',
    price: item.price ?? '',
    status: item.status || 'active',
    category: item.category || 'other',
    condition: item.condition || 'good',
    city: item.city || '',
    state: item.state || '',
    country: item.country || '',
    media: Array.isArray(item.media) ? [...item.media] : [],
  });

  useEffect(() => {
    if (!listing) return;
    if (searchParams.get('edit') === '1') {
      setEditForm(buildEditForm(listing));
      setEditing(true);
      setSearchParams({}, { replace: true });
    }
  }, [listing, searchParams, setSearchParams]);

  const openEdit = () => {
    if (!listing) return;
    setEditForm(buildEditForm(listing));
    setEditing(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(false);
    setEditForm(null);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!listing || !editForm) return;
    const price = Number(editForm.price);
    if (!editForm.title.trim()) {
      showToast('Title is required.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showToast('Enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const data = await updateAdminMarketplaceListing(listing.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price,
        status: editForm.status,
        category: editForm.category,
        condition: editForm.condition,
        city: editForm.city.trim(),
        state: editForm.state.trim(),
        country: editForm.country.trim(),
        media: editForm.media || [],
      });
      showToast('Listing updated.');
      if (data?.listing) {
        setListing((prev) => ({ ...prev, ...data.listing }));
        setActiveMedia(0);
      } else {
        await load();
      }
      setEditing(false);
      setEditForm(null);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update listing.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-fo-muted">
        <Loader2 size={16} className="animate-spin text-fo-accent" />
        Loading listing…
      </div>
    );
  }

  if (!listing) return null;

  const media = Array.isArray(listing.media) ? listing.media : [];
  const current = media[activeMedia] || media[0];
  const location = formatLocation(listing);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/marketplace')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
        >
          <ArrowLeft size={14} />
          Back to marketplace
        </button>
        <button
          type="button"
          onClick={openEdit}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fo-accent/35 text-xs font-semibold text-fo-accent hover:bg-fo-accent/10"
        >
          <Pencil size={14} />
          Edit listing
        </button>
      </div>

      <div className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
        <div className="aspect-[16/10] bg-fo-bg relative">
          {current?.url ? (
            current.type === 'video' ? (
              <video
                src={current.url}
                controls
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                src={current.url}
                alt=""
                className="w-full h-full object-contain bg-fo-bg"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-fo-subtle">
              No media
            </div>
          )}
        </div>

        {media.length > 1 ? (
          <div className="flex gap-2 p-3 overflow-x-auto border-t border-fo-border">
            {media.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                onClick={() => setActiveMedia(index)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border ${
                  activeMedia === index
                    ? 'border-fo-accent'
                    : 'border-fo-border opacity-80 hover:opacity-100'
                }`}
              >
                {item.type === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        ) : null}

        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-fo-accent">
                {statusLabel(listing.status)}
              </span>
              {listing.pendingReports > 0 ? (
                <span className="text-[10px] font-semibold text-red-400">
                  {listing.pendingReports} pending report(s)
                </span>
              ) : null}
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
              {listing.title}
            </h1>
            <p className="text-lg font-semibold text-fo-accent">
              {formatPrice(listing.price, listing.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fo-subtle">
            <span>{categoryLabel(listing.category)}</span>
            <span>{conditionLabel(listing.condition)}</span>
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {location}
              </span>
            ) : null}
            <span>{timeAgo(listing.createdAt)}</span>
          </div>

          {listing.description ? (
            <p className="text-sm text-fo-text whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </p>
          ) : null}

          <div className="rounded-xl border border-fo-border bg-fo-bg/50 p-3.5 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-fo-subtle">
              Seller
            </p>
            <p className="text-sm font-medium text-fo-text">
              {listing.seller?.name || listing.seller?.username || 'Unknown'}
              {listing.seller?.username ? (
                <span className="text-fo-subtle font-normal">
                  {' '}
                  @{listing.seller.username}
                </span>
              ) : null}
            </p>
            {listing.seller?.email ? (
              <p className="text-xs text-fo-subtle">{listing.seller.email}</p>
            ) : null}
            {listing.seller?.phone ? (
              <p className="text-xs text-fo-subtle">{listing.seller.phone}</p>
            ) : null}
            {listing.sellerStatus && listing.sellerStatus !== 'active' ? (
              <p className="text-xs text-red-400">
                Account status: {listing.sellerStatus}
              </p>
            ) : null}
            {listing.seller?.id ? (
              <AdminUserLink
                userId={listing.seller.id}
                className="inline-block text-xs text-fo-accent hover:underline pt-1"
              >
                Open seller in User Management
              </AdminUserLink>
            ) : null}
          </div>
        </div>
      </div>

      {editing && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeEdit}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-fo-surface border border-fo-border rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-fo-text">Edit listing</h2>
              <button
                type="button"
                disabled={saving}
                onClick={closeEdit}
                className="text-fo-subtle hover:text-fo-text p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                  Title
                </label>
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={4}
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                  Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, price: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, status: e.target.value }))
                    }
                    className={inputClass}
                  >
                    {LISTING_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                    Condition
                  </label>
                  <select
                    value={editForm.condition}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, condition: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="new">New</option>
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1">
                  Category
                </label>
                <input
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="City"
                />
                <input
                  value={editForm.state}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, state: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="State"
                />
                <input
                  value={editForm.country}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, country: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Country"
                />
              </div>

              <MediaPicker
                media={editForm.media || []}
                onChange={(media) => setEditForm((f) => ({ ...f, media }))}
                onError={(msg) => msg && showToast(msg)}
                accept="image/*"
                label="Photos"
                max={8}
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeEdit}
                  className="flex-1 py-2.5 rounded-xl border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-text disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-fo-accent text-black text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
