import { useRef, useState } from "react";
import { LuImagePlus as ImagePlus, LuLoaderCircle as Loader2, LuX as X } from "react-icons/lu";
import { uploadMedia } from "../../../api/uploads";
import LocationFields from "../../../shared/components/LocationFields";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../shared/utils/errors";
import { LISTING_CATEGORIES } from "../../marketplace/constants";
import { createStore } from "../services/storeService";

const fieldClass =
  "w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text";
const labelClass = "block text-[10px] uppercase tracking-wider text-fo-subtle mb-1";

const mediaRecord = (value) => {
  if (!value || typeof value !== "object") return null;
  const url = String(value.url || "");
  if (!/^https:\/\//.test(url)) return null;
  return {
    url,
    publicId: value.publicId || "",
    type: "image",
    signature: value.signature || "",
  };
};

const previewSlug = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

const emptyForm = {
  name: "",
  description: "",
  category: "other",
  city: "",
  state: "",
  country: "",
  contactPhone: "",
  contactEmail: "",
};

export default function CreateStoreModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const logoRef = useRef(null);
  const coverRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setForm(emptyForm);
    setLogoFile(null);
    setCoverFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setLogoPreview("");
    setCoverPreview("");
    if (logoRef.current) logoRef.current.value = "";
    if (coverRef.current) coverRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickImage = (file, setFile, setPreview, currentPreview) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      showToast("Choose an image file.");
      return;
    }
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast("Store name is required.");
      return;
    }
    if (!form.country.trim()) {
      showToast("Country is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
      };
      if (logoFile) {
        const upload = await uploadMedia(logoFile, "fointer/stores");
        payload.logo = mediaRecord(upload?.media);
      }
      if (coverFile) {
        const upload = await uploadMedia(coverFile, "fointer/stores");
        payload.coverImage = mediaRecord(upload?.media);
      }
      const result = await createStore(payload);
      showToast("Store created.");
      reset();
      onCreated?.(result?.store);
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to create store."));
    } finally {
      setSaving(false);
    }
  };

  const slug = previewSlug(form.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--theme-overlay)] backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-fo-border bg-fo-surface text-fo-text shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-fo-border bg-fo-surface px-5 py-4">
          <h2 className="text-lg font-semibold">Create store</h2>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Store name *</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={fieldClass}
              maxLength={80}
              placeholder="Ada's Fashion"
            />
            {slug ? (
              <p className="mt-1 text-[11px] text-fo-subtle">fointer.net/store/{slug}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              maxLength={2000}
              className={`${fieldClass} resize-y`}
              placeholder="What do you sell?"
            />
          </div>
          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className={fieldClass}
            >
              {LISTING_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <LocationFields
            value={{ country: form.country, state: form.state, city: form.city }}
            onChange={(next) =>
              setForm((current) => ({
                ...current,
                country: next.country || "",
                state: next.state || "",
                city: next.city || "",
              }))
            }
            inputClass={fieldClass}
            labelClass={labelClass}
            showAddress={false}
            showPostal={false}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input
                value={form.contactPhone}
                onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                className={fieldClass}
                maxLength={32}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                className={fieldClass}
                maxLength={254}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ImagePick
              label="Logo"
              preview={logoPreview}
              inputRef={logoRef}
              onPick={(file) => pickImage(file, setLogoFile, setLogoPreview, logoPreview)}
            />
            <ImagePick
              label="Cover"
              preview={coverPreview}
              inputRef={coverRef}
              onPick={(file) => pickImage(file, setCoverFile, setCoverPreview, coverPreview)}
              wide
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="min-h-9 px-3 text-sm text-fo-muted hover:text-fo-text">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-9 px-4 rounded-full bg-fo-accent text-black text-sm font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Create store
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImagePick({ label, preview, inputRef, onPick, wide = false }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-fo-border bg-fo-bg text-fo-subtle hover:border-fo-accent/40 ${
          wide ? "h-28 w-full" : "h-28 w-28"
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs">
            <ImagePlus size={14} /> Upload
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onPick(event.target.files?.[0])}
      />
    </div>
  );
}
