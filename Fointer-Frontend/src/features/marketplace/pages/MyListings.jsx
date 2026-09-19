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
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";
import MarketplaceRail from "../components/MarketplaceRail";
import { LISTING_STATUSES, statusLabel } from "../constants";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  ...LISTING_STATUSES.map((status) => ({
    id: status.value,
    label: status.label,
  })),
];

const filterBtnClass = (active) =>
  `relative px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg ${
    active ? "text-fo-accent" : "text-fo-subtle hover:text-fo-text"
  }`;

export default function MyListings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    for (const status of LISTING_STATUSES) {
      byStatus[status.value] = listings.filter(
        (item) => item.status === status.value
      ).length;
    }
    return { all, ...byStatus };
  }, [listings]);

  const visible = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((item) => item.status === filter);
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
    try {
      await markListingSold(listing.id);
      showToast("Listing marked as sold.");
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteListing(deleteTarget.id);
      setDeleteTarget(null);
      showToast("Listing deleted.");
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete listing.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <button
        type="button"
        onClick={() => navigate("/marketplace")}
        className="inline-flex items-center gap-2 min-h-9 px-1 mb-3 text-sm text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
      >
        <ArrowLeft size={16} /> Back to marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fo-text leading-tight">
                My listings
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug">
                Create, edit, and manage what you are selling.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover shrink-0"
            >
              <Plus size={16} aria-hidden /> New listing
            </button>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 border-b border-fo-border pb-1"
            role="group"
            aria-label="Filter listings"
          >
            {STATUS_FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={filterBtnClass(active)}
                >
                  {item.label}
                  {counts[item.id] != null ? ` (${counts[item.id]})` : ""}
                  {active ? (
                    <span className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-fo-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-fo-muted">
              <Loader2 size={20} className="animate-spin text-fo-accent" />
            </div>
          ) : visible.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
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
                className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
              >
                Create your first listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visible.map((listing) => (
                <div key={listing.id} className="space-y-2">
                  <ListingCard listing={listing} />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(listing)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                    >
                      Edit
                    </button>
                    {listing.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkSold(listing)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                      >
                        Mark sold
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(listing)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <MarketplaceRail
            onSelectCategory={(value) => {
              const params = new URLSearchParams();
              if (value) params.set("category", value);
              navigate(`/marketplace${params.toString() ? `?${params}` : ""}`);
            }}
            isGuest={!isAuthenticated}
          />
        </div>
      </div>

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

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete listing?"
        variant="post"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget
          ? `"${deleteTarget.title}" will be removed from the marketplace.`
          : "This listing will be removed from the marketplace."}
      </ConfirmDeleteModal>
    </div>
  );
}
