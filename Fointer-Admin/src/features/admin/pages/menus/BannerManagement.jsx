import { useCallback, useEffect, useState } from "react";
import {
  LuImage as ImageIcon,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuTrash2 as Trash2,
} from "react-icons/lu";
import {
  createAdminBanner,
  deleteAdminBanner,
  fetchAdminBanners,
  updateAdminBanner,
} from "../../../../api/dashboard";
import { uploadMedia } from "../../../../api/uploads";
import AdminActionBtn from "../../../../shared/components/AdminActionBtn";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const emptyForm = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  imagePublicId: "",
  isActive: true,
  displayOrder: 0,
  startsAt: "",
  endsAt: "",
};

const toDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const inputClass =
  "w-full bg-fo-surface-hover border border-fo-border rounded-lg p-2.5 text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent";

const bannerFeedStatus = (banner, now = new Date()) => {
  if (!banner.isActive) return "Off";
  if (banner.startsAt && new Date(banner.startsAt) > now) return "Scheduled";
  if (banner.endsAt) {
    const end = new Date(banner.endsAt);
    if (!Number.isNaN(end.getTime())) {
      const until = Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate(),
        23,
        59,
        59,
        999
      );
      if (until < now.getTime()) return "Ended";
    }
  }
  return "On Feed";
};

export default function BannerManagement() {
  const { showToast } = useToast();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBanners();
      setBanners(data?.banners || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load banners."));
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      ctaLabel: banner.ctaLabel || "",
      ctaUrl: banner.ctaUrl || "",
      imageUrl: banner.imageUrl || "",
      imagePublicId: banner.imagePublicId || "",
      isActive: banner.isActive !== false,
      displayOrder: banner.displayOrder ?? 0,
      startsAt: toDatetimeLocal(banner.startsAt),
      endsAt: toDatetimeLocal(banner.endsAt),
    });
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadMedia(file, "fointer/banners");
      if (data?.media?.url) {
        setForm((prev) => ({
          ...prev,
          imageUrl: data.media.url,
          imagePublicId: data.media.publicId || "",
        }));
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const payloadFromForm = () => ({
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    ctaLabel: form.ctaLabel.trim(),
    ctaUrl: form.ctaUrl.trim(),
    imageUrl: form.imageUrl.trim(),
    imagePublicId: form.imagePublicId.trim(),
    isActive: Boolean(form.isActive),
    displayOrder: Number(form.displayOrder) || 0,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = payloadFromForm();
    if (!payload.imageUrl && !payload.title) {
      showToast("Add a banner image or a title.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAdminBanner(editingId, payload);
        showToast("Banner updated.");
      } else {
        await createAdminBanner(payload);
        showToast("Banner created.");
      }
      resetForm();
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to save banner."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteAdminBanner(deleteId);
      if (editingId === deleteId) resetForm();
      setDeleteId(null);
      showToast("Banner deleted.");
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete banner."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-fo-text">
            Banner Management
          </h1>
          <p className="text-xs text-fo-subtle mt-1">
            The Feed shows up to 3 active banners in one row. Leave start/end
            empty to keep a banner on the Feed. If you set an end date, it stays
            visible through that full day.
          </p>
        </div>
        <AdminActionBtn onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </AdminActionBtn>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-fo-surface border border-fo-border rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fo-text">
            {editingId ? "Edit banner" : "Create banner"}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-fo-subtle hover:text-fo-accent"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-fo-text">Title</span>
              <input
                className={inputClass}
                value={form.title}
                maxLength={120}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Headline shown on the Feed"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-fo-text">
                Subtitle
              </span>
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={form.subtitle}
                maxLength={240}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subtitle: e.target.value }))
                }
                placeholder="Optional supporting line"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-fo-text">
                  CTA label
                </span>
                <input
                  className={inputClass}
                  value={form.ctaLabel}
                  maxLength={40}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ctaLabel: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-fo-text">
                  CTA URL
                </span>
                <input
                  className={inputClass}
                  value={form.ctaUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ctaUrl: e.target.value }))
                  }
                  placeholder="/communities or https://…"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-fo-text">Image</span>
              <div className="relative overflow-hidden rounded-xl border border-fo-border bg-fo-surface-hover h-36">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-fo-subtle text-xs gap-2">
                    <ImageIcon size={16} /> No image
                  </div>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-fo-accent cursor-pointer">
                {uploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Plus size={13} />
                )}
                {uploading ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-fo-text">
                  Display order
                </span>
                <input
                  type="number"
                  className={inputClass}
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, displayOrder: e.target.value }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs text-fo-text">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-fo-text">
                  Starts
                </span>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startsAt: e.target.value }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-fo-text">Ends</span>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endsAt: e.target.value }))
                  }
                />
              </label>
            </div>
            <p className="text-[11px] text-fo-subtle">
              Optional. An end date keeps the banner on Feed through that full
              day. Leave both empty to show it whenever it is Active.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? "Save changes" : "Create banner"}
          </button>
        </div>
      </form>

      <div className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
            <Loader2 size={16} className="animate-spin text-fo-accent" />
            Loading banners…
          </div>
        ) : banners.length === 0 ? (
          <p className="py-14 text-center text-sm text-fo-subtle">
            No banners yet. Create one to show it on the Feed.
          </p>
        ) : (
          <ul className="divide-y divide-fo-border">
            {banners.map((banner) => (
              <li
                key={banner.id}
                className="flex items-center gap-3 p-3 sm:p-4"
              >
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-fo-surface-hover border border-fo-border shrink-0">
                  {banner.imageUrl ? (
                    <img
                      src={banner.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fo-text truncate">
                    {banner.title || "Untitled banner"}
                  </p>
                  <p className="text-[11px] text-fo-subtle truncate">
                    Order {banner.displayOrder ?? 0}
                    {" · "}
                    {bannerFeedStatus(banner)}
                    {banner.createdAt ? ` · ${timeAgo(banner.createdAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AdminActionBtn onClick={() => startEdit(banner)}>
                    <Pencil size={13} /> Edit
                  </AdminActionBtn>
                  <AdminActionBtn
                    tone="danger"
                    onClick={() => setDeleteId(banner.id)}
                  >
                    <Trash2 size={13} />
                  </AdminActionBtn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteId)}
        title="Delete banner?"
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      >
        This banner will no longer appear on the Feed.
      </ConfirmDeleteModal>
    </div>
  );
}
