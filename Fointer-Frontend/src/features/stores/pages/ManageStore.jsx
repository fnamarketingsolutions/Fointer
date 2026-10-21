import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { fetchMyListings } from "../../../api/marketplace";
import { uploadMedia } from "../../../api/uploads";
import LocationFields from "../../../shared/components/LocationFields";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import { getErrorMessage } from "../../../shared/utils/errors";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import ListingCard from "../../marketplace/components/ListingCard";
import ListingFormModal from "../../marketplace/components/ListingFormModal";
import { categoryLabel, LISTING_CATEGORIES } from "../../marketplace/constants";
import { createListing, updateListing } from "../../marketplace/services/marketplaceService";
import {
  createStoreCategory,
  deleteStoreCategory,
  fetchStore,
  deleteStore,
  updateStore,
} from "../services/storeService";

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

export default function ManageStore() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [store, setStore] = useState(null);
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storeRes, listingRes] = await Promise.all([
          fetchStore(storeId),
          fetchMyListings(),
        ]);
        if (cancelled) return;
        const next = storeRes?.store;
        setStore(next);
        setForm(
          next
            ? {
                name: next.name || "",
                slug: next.slug || "",
                description: next.description || "",
                category: next.category || "other",
                city: next.city || "",
                state: next.state || "",
                country: next.country || "",
                contactPhone: next.contactPhone || "",
                contactEmail: next.contactEmail || "",
              }
            : null
        );
        const storeKey = String(next?.id || "");
        setProducts(
          (listingRes?.listings || []).filter(
            (listing) => String(listing.store?.id || "") === storeKey
          )
        );
      } catch (error) {
        if (cancelled) return;
        setStore(null);
        showToast(getErrorMessage(error, "Failed to load store."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast, storeId]);

  const saveStore = async (event) => {
    event.preventDefault();
    if (!form?.name.trim() || !form.country.trim() || !form.slug.trim()) {
      showToast("Name, link, and country are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
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
      const result = await updateStore(store.id, payload);
      setStore(result?.store || store);
      setLogoFile(null);
      setCoverFile(null);
      setLogoPreview("");
      setCoverPreview("");
      showToast("Store updated.");
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to update store."));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    try {
      const result = await createStoreCategory(store.id, name);
      setCategoryName("");
      if (result?.category) {
        setStore((current) => ({
          ...current,
          categories: [...(current.categories || []), result.category],
        }));
      }
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to add category."));
    } finally {
      setAddingCategory(false);
    }
  };

  const removeCategory = async (categoryId) => {
    try {
      await deleteStoreCategory(store.id, categoryId);
      setStore((current) => ({
        ...current,
        categories: (current.categories || []).filter((category) => category.id !== categoryId),
      }));
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to remove category."));
    }
  };

  const saveProduct = async (payload, existing) => {
    setSubmitting(true);
    try {
      if (existing) await updateListing(existing.id, payload);
      else await createListing({ ...payload, store: payload.store || store.id });
      showToast(existing ? "Product updated." : "Product added.");
      setProductOpen(false);
      setEditing(null);
      const listingRes = await fetchMyListings();
      const storeKey = String(store.id);
      setProducts(
        (listingRes?.listings || []).filter(
          (listing) => String(listing.store?.id || "") === storeKey
        )
      );
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to save product."));
    } finally {
      setSubmitting(false);
    }
  };

  const removeStore = async () => {
    setDeleting(true);
    try {
      const result = await deleteStore(store.id);
      showToast(result?.message || "Store deleted.");
      navigate("/stores/manage");
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to delete store."));
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader minHeight="min-h-[40vh]" />;
  if (!store || !form) {
    return <p className="p-6 text-sm text-fo-subtle">Store not found.</p>;
  }

  const logoSrc = logoPreview || displayImageUrl(store.logo, 160);
  const coverSrc = coverPreview || displayImageUrl(store.coverImage, 800);

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 pb-10 text-fo-text">
      <div className="overflow-hidden rounded-2xl border border-fo-border bg-fo-surface">
        <div className="relative h-36 bg-fo-bg">
          {coverSrc ? <img src={coverSrc} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex items-end gap-3 px-4 pb-4">
          <div className="-mt-8 h-16 w-16 overflow-hidden rounded-xl border border-fo-border bg-fo-bg">
            {logoSrc ? <img src={logoSrc} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-lg font-semibold">{store.name}</h1>
            <Link to={`/store/${store.slug}`} className="text-xs text-fo-accent hover:underline">
              /store/{store.slug}
            </Link>
          </div>
        </div>
      </div>

      {store.status === "suspended" ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
          This store is suspended. Shoppers cannot see it until it is restored.
        </p>
      ) : null}

      <form onSubmit={saveStore} className="space-y-4 rounded-2xl border border-fo-border bg-fo-surface p-4">
        <h2 className="text-sm font-semibold">Store details</h2>
        <div>
          <label className={labelClass}>Name</label>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} maxLength={80} />
        </div>
        <div>
          <label className={labelClass}>Link</label>
          <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} className={fieldClass} maxLength={60} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className={`${fieldClass} resize-y`} maxLength={2000} />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={fieldClass}>
            {LISTING_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
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
            <input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} className={fieldClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-fo-muted">
            Replace logo
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setLogoFile(file);
                setLogoPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return file ? URL.createObjectURL(file) : "";
                });
              }}
            />
          </label>
          <label className="text-xs text-fo-muted">
            Replace cover
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setCoverFile(file);
                setCoverPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return file ? URL.createObjectURL(file) : "";
                });
              }}
            />
          </label>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 min-h-9 px-4 rounded-full bg-fo-accent text-black text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save store
        </button>
      </form>

      <section className="rounded-2xl border border-red-500/30 bg-fo-surface p-4">
        <h2 className="text-sm font-semibold">Delete store</h2>
        <p className="mt-1 text-xs text-fo-subtle">
          The storefront is removed. Products stay on the marketplace as personal listings.
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-3 inline-flex min-h-9 items-center rounded-full border border-red-500/40 px-4 text-sm font-medium text-red-500"
        >
          Delete store
        </button>
      </section>

      <section className="rounded-2xl border border-fo-border bg-fo-surface p-4">
        <h2 className="text-sm font-semibold">Product sections</h2>
        <form onSubmit={addCategory} className="mt-3 flex gap-2">
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Dresses, shoes..."
            maxLength={40}
            className={fieldClass}
          />
          <button type="submit" disabled={addingCategory} className="shrink-0 rounded-full bg-fo-accent px-3 text-xs font-semibold text-black disabled:opacity-60">
            Add
          </button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(store.categories || []).map((category) => (
            <li key={category.id} className="inline-flex items-center gap-2 rounded-full border border-fo-border px-3 py-1 text-xs">
              {category.name}
              <button type="button" onClick={() => removeCategory(category.id)} className="text-fo-subtle hover:text-red-500" aria-label={`Remove ${category.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Products</h2>
          <button type="button" onClick={() => setProductOpen(true)} className="rounded-full bg-fo-accent px-3 py-1.5 text-xs font-semibold text-black">
            Add product
          </button>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-fo-subtle">No products in this store yet. {categoryLabel(store.category)} listings you add here also show in the Marketplace.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {products.map((listing) => (
              <div key={listing.id}>
                <ListingCard listing={listing} />
                <button type="button" onClick={() => setEditing(listing)} className="mt-1 text-xs text-fo-accent hover:underline">
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ListingFormModal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        onSubmit={(payload) => saveProduct(payload, null)}
        submitting={submitting}
        title="Add product"
        defaultStoreId={store.id}
      />
      <ListingFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={(payload) => saveProduct(payload, editing)}
        submitting={submitting}
        initial={editing}
        title="Edit product"
        defaultStoreId={store.id}
      />
      <ConfirmDeleteModal
        open={confirmDelete}
        title="Delete store"
        variant="dashboard"
        loading={deleting}
        confirmLabel="Delete store"
        onConfirm={removeStore}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
      >
        Delete {store.name}? This cannot be undone. Products from this store stay on the marketplace.
      </ConfirmDeleteModal>
    </div>
  );
}
