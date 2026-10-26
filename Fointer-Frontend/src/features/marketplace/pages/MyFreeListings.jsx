import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuArrowLeft as ArrowLeft, LuPlus as Plus } from "react-icons/lu";
import {
  deleteFreeListing,
  fetchMyFreeListings,
  markFreeListingSold,
  updateFreeListing,
} from "../../../api/marketplace";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";

export default function MyFreeListings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchMyFreeListings();
      setListings(result?.listings || []);
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to load your free listings.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = async (payload) => {
    setSubmitting(true);
    try {
      const result = await updateFreeListing(editing.id, payload);
      setListings((items) =>
        items.map((item) => item.id === editing.id ? result?.listing || item : item)
      );
      setEditing(null);
      showToast("Free listing updated.");
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to update free listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const markSold = async (listing) => {
    try {
      const result = await markFreeListingSold(listing.id);
      setListings((items) =>
        items.map((item) => item.id === listing.id ? result?.listing || item : item)
      );
      showToast("Free listing marked as claimed.");
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to update free listing.");
    }
  };

  const removeListing = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFreeListing(deleteTarget.id);
      setListings((items) => items.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Free listing deleted.");
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to delete free listing.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4 pb-6 text-fo-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate("/free-listings")}
            className="mb-2 inline-flex items-center gap-2 text-sm text-fo-muted hover:text-fo-accent"
          >
            <ArrowLeft size={15} /> Free listings
          </button>
          <h1 className="text-xl font-semibold">My free listings</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/free-listings")}
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-fo-accent px-3.5 text-sm font-semibold text-black"
        >
          <Plus size={15} /> Give away an item
        </button>
      </div>

      {loading ? (
        <PageLoader minHeight="py-16" size="md" />
      ) : listings.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.id} className="space-y-2">
              <ListingCard listing={listing} freeListing />
              <div className="flex flex-wrap gap-2">
                {listing.canEdit || listing.canChangeStatus ? (
                  <button
                    type="button"
                    onClick={() => setEditing(listing)}
                    className="rounded-full border border-fo-border px-3 py-1.5 text-xs text-fo-text"
                  >
                    Edit
                  </button>
                ) : null}
                {listing.canMarkSold ? (
                  <button
                    type="button"
                    onClick={() => markSold(listing)}
                    className="rounded-full border border-fo-border px-3 py-1.5 text-xs text-fo-text"
                  >
                    Mark claimed
                  </button>
                ) : null}
                {listing.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(listing)}
                    className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-500"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-fo-border py-14 text-center text-sm text-fo-subtle">
          <p>You have not posted any free listings yet.</p>
          <button
            type="button"
            onClick={() => navigate("/free-listings")}
            className="mt-3 font-medium text-fo-accent"
          >
            Browse free listings
          </button>
        </div>
      )}

      <ListingFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
        submitting={submitting}
        initial={editing}
        title="Edit free listing"
        isFree
      />
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete free listing?"
        variant="post"
        loading={deleting}
        onConfirm={removeListing}
        onClose={() => setDeleteTarget(null)}
      >
        This free listing will be permanently removed.
      </ConfirmDeleteModal>
    </div>
  );
}
