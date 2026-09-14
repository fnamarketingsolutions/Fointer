import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
} from "react-icons/lu";
import {
  createListing,
  deleteListing,
  fetchMyListings,
  markListingSold,
  updateListing,
} from "../../../api/marketplace";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";
import { LISTING_STATUSES, statusLabel } from "../constants";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  ...LISTING_STATUSES.map((status) => ({
    id: status.value,
    label: status.label,
  })),
];

export default function MyListings() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyListings();
      setListings(res?.listings || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const all = listings.length;
    const byStatus = {};
    for (const s of LISTING_STATUSES) {
      byStatus[s.value] = listings.filter((l) => l.status === s.value).length;
    }
    return { all, ...byStatus };
  }, [listings]);

  const visible = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((l) => l.status === filter);
  }, [listings, filter]);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      const res = await createListing(payload);
      showToast("Listing created.");
      setModalOpen(false);
      const id = res?.listing?.shortCode || res?.listing?.id;
      if (id) navigate(`/marketplace/${id}`);
      else load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (payload) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateListing(editing.id, payload);
      showToast("Listing updated.");
      setEditing(null);
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSold = async (listing) => {
    if (!window.confirm(`Mark "${listing.title}" as sold?`)) return;
    try {
      await markListingSold(listing.id);
      showToast("Listing marked as sold.");
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    }
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}" permanently?`)) return;
    try {
      await deleteListing(listing.id);
      showToast("Listing deleted.");
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete listing.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <button
        type="button"
        onClick={() => navigate("/marketplace")}
        className="inline-flex items-center gap-2 text-sm text-fo-muted hover:text-fo-text mb-6"
      >
        <ArrowLeft size={16} /> Back to Marketplace
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fo-text">My listings</h1>
          <p className="mt-2 text-sm text-fo-muted">
            Create, edit, and manage your marketplace listings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-fo-bg text-sm font-medium shrink-0"
        >
          <Plus size={16} /> New listing
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === item.id
                ? "bg-fo-accent text-fo-bg border-fo-accent"
                : "border-fo-border text-fo-muted hover:text-fo-text"
            }`}
          >
            {item.label}
            {counts[item.id] != null ? ` (${counts[item.id]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center text-fo-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-12 text-center text-fo-muted text-sm">
          <p>
            No{" "}
            {filter === "all"
              ? ""
              : `${(statusLabel(filter) || filter).toLowerCase()} `}
            listings yet.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 text-fo-accent hover:underline"
          >
            Create your first listing
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((listing) => (
            <div key={listing.id} className="space-y-2">
              <ListingCard listing={listing} />
              <div className="flex flex-wrap gap-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setEditing(listing)}
                  className="text-[11px] px-2 py-1 rounded border border-fo-border text-fo-muted hover:text-fo-text"
                >
                  Edit
                </button>
                {listing.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => handleMarkSold(listing)}
                    className="text-[11px] px-2 py-1 rounded border border-fo-border text-fo-muted hover:text-fo-text"
                  >
                    Mark sold
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDelete(listing)}
                  className="text-[11px] px-2 py-1 rounded border border-red-500/30 text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
      />

      <ListingFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
        submitting={submitting}
        initial={editing}
        title="Edit listing"
      />
    </div>
  );
}
