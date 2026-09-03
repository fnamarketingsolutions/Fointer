import React, { useEffect, useState } from "react";
import { LuLoaderCircle as Loader2, LuX as X } from "react-icons/lu";
import MediaPicker from "../../../shared/components/media/MediaPicker";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "../constants";

const emptyForm = () => ({
  title: "",
  description: "",
  price: "",
  currency: "USD",
  category: "other",
  condition: "good",
  city: "",
  state: "",
  country: "",
  media: [],
  status: "active",
});

export default function ListingFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting = false,
  title = "Create listing",
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title || "",
        description: initial.description || "",
        price: initial.price != null ? String(initial.price) : "",
        currency: initial.currency || "USD",
        category: initial.category || "other",
        condition: initial.condition || "good",
        city: initial.city || "",
        state: initial.state || "",
        country: initial.country || "",
        media: initial.media || [],
        status: initial.status || "active",
      });
    } else {
      setForm(emptyForm());
    }
    setError("");
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    setError("");
    await onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      price,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-fo-border bg-fo-surface shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-fo-border bg-fo-surface px-5 py-4">
          <h2 className="text-lg font-semibold text-fo-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-bg"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
              Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              placeholder="What are you selling?"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={4}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text resize-y"
              placeholder="Describe your item, pickup options, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Price *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Currency
              </label>
              <input
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                }
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              >
                {LISTING_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Condition
              </label>
              <select
                value={form.condition}
                onChange={(e) =>
                  setForm((f) => ({ ...f, condition: e.target.value }))
                }
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              >
                {LISTING_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                City
              </label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                State
              </label>
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Country
              </label>
              <input
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              />
            </div>
          </div>

          <MediaPicker
            media={form.media}
            onChange={(media) => setForm((f) => ({ ...f, media }))}
            onError={setError}
            accept="image/*"
            label="Photos"
            max={8}
          />

          {initial ? (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
              >
                {LISTING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className="text-[11px] text-fo-subtle leading-relaxed">
            Fointer does not process payments, payouts, escrow, or shipping.
            Buyers and sellers arrange those details directly.
          </p>

          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-fo-muted hover:text-fo-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-fo-bg text-sm font-medium disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                "Save listing"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
