import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuFlag as Flag,
  LuLoaderCircle as Loader2,
  LuMapPin as MapPin,
  LuMessageCircle as MessageCircle,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
} from "react-icons/lu";
import {
  contactSeller,
  deleteListing,
  fetchListing,
  markListingSold,
  updateListing,
} from "../../../api/marketplace";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";
import ListingFormModal from "../components/ListingFormModal";
import MarketplaceRail from "../components/MarketplaceRail";
import {
  categoryLabel,
  conditionLabel,
  formatLocation,
  formatPrice,
} from "../constants";
import { timeAgo } from "../../../shared/utils/date";

export default function ListingDetail() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contacting, setContacting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchListing(listingId);
      setListing(res?.listing || null);
      setActiveImage(0);
    } catch (err) {
      showToast(err?.response?.data?.message || "Listing not found.");
      navigate("/marketplace", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [listingId, navigate, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const count = Array.isArray(listing?.media) ? listing.media.length : 0;
    if (count < 2) return undefined;
    const onKey = (event) => {
      if (event.key === "ArrowLeft") {
        setActiveImage((index) => (index - 1 + count) % count);
      }
      if (event.key === "ArrowRight") {
        setActiveImage((index) => (index + 1) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listing]);

  const handleContact = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/marketplace/${listingId}` } });
      return;
    }
    if (!contactMessage.trim()) {
      showToast("Please write a message.");
      return;
    }
    setContacting(true);
    try {
      const res = await contactSeller(listing.id, {
        message: contactMessage.trim(),
      });
      setContactOpen(false);
      setContactMessage("");
      const conversationId = res?.conversationId;
      if (conversationId) navigate(`/messages/${conversationId}`);
      else showToast("Message sent to seller.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setContacting(false);
    }
  };

  const handleMarkSold = async () => {
    try {
      const res = await markListingSold(listing.id);
      setListing(res?.listing || listing);
      showToast("Listing marked as sold.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteListing(listing.id);
      setDeleteOpen(false);
      showToast("Listing deleted.");
      navigate("/marketplace/my-listings", { replace: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete listing.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = async (payload) => {
    setSubmitting(true);
    try {
      const res = await updateListing(listing.id, payload);
      setListing(res?.listing || listing);
      showToast("Listing updated.");
      setEditOpen(false);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const goCategory = (value) => {
    const params = new URLSearchParams();
    if (value) params.set("category", value);
    navigate(`/marketplace${params.toString() ? `?${params}` : ""}`);
  };

  if (loading) {
    return (
      <div className="w-full max-w-[1180px] mx-auto flex items-center justify-center py-20 text-fo-muted">
        <Loader2 size={20} className="animate-spin text-fo-accent" />
      </div>
    );
  }

  if (!listing) return null;

  const media = Array.isArray(listing.media) ? listing.media.filter(Boolean) : [];
  const mediaCount = media.length;
  const safeIndex =
    mediaCount === 0 ? 0 : Math.min(activeImage, mediaCount - 1);
  const current = media[safeIndex];
  const location = formatLocation(listing);
  const isSold = listing.status === "sold";
  const canScrollMedia = mediaCount > 1;

  const goPrev = () => {
    if (!canScrollMedia) return;
    setActiveImage((index) => (index - 1 + mediaCount) % mediaCount);
  };

  const goNext = () => {
    if (!canScrollMedia) return;
    setActiveImage((index) => (index + 1) % mediaCount);
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
          <article className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
            <div className="relative w-full pt-[56.25%] bg-fo-surface-2">
              {current ? (
                current.type === "video" ? (
                  <video
                    src={current.url}
                    controls
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                ) : (
                  <img
                    src={current.url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-fo-subtle text-sm">
                  No photos
                </div>
              )}
              {isSold ? (
                <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wide">
                  Sold
                </span>
              ) : null}
              {canScrollMedia ? (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-medium">
                    {safeIndex + 1} / {mediaCount}
                  </span>
                </>
              ) : null}
            </div>
            {canScrollMedia ? (
              <div className="flex gap-2 p-3 overflow-x-auto border-t border-fo-border">
                {media.map((item, idx) => (
                  <button
                    key={`${item.url}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border ${
                      idx === safeIndex
                        ? "border-fo-accent"
                        : "border-fo-border hover:border-fo-accent/40"
                    }`}
                    aria-label={`View image ${idx + 1}`}
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-xl font-semibold text-fo-text">
                  {formatPrice(listing.price, listing.currency)}
                </p>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-fo-text leading-snug">
                  {listing.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fo-subtle">
                  {location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {location}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => goCategory(listing.category)}
                    className="hover:text-fo-accent"
                  >
                    {categoryLabel(listing.category)}
                  </button>
                  <span>· {conditionLabel(listing.condition)}</span>
                  <span>· Listed {timeAgo(listing.createdAt)}</span>
                </div>
              </div>

              {listing.description ? (
                <p className="text-sm text-fo-muted leading-relaxed whitespace-pre-wrap">
                  {listing.description}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-fo-border">
                {!listing.isOwner && listing.status === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) {
                          navigate("/login", {
                            state: { from: `/marketplace/${listingId}` },
                          });
                          return;
                        }
                        setContactOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover"
                    >
                      <MessageCircle size={16} /> Contact seller
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-muted hover:text-red-400"
                    >
                      <Flag size={15} /> Report
                    </button>
                  </>
                ) : null}

                {listing.canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
                  >
                    <Pencil size={15} /> Edit
                  </button>
                ) : null}

                {listing.canMarkSold ? (
                  <button
                    type="button"
                    onClick={handleMarkSold}
                    className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
                  >
                    Mark as sold
                  </button>
                ) : null}

                {listing.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border border-red-500/30 text-[13px] font-medium text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <MarketplaceRail
            selectedCategory={listing.category || ""}
            onSelectCategory={goCategory}
            isGuest={!isAuthenticated}
            seller={listing.seller}
          />
        </div>
      </div>

      {contactOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--theme-overlay)] backdrop-blur-sm"
            onClick={() => setContactOpen(false)}
            aria-label="Close"
          />
          <form
            onSubmit={handleContact}
            className="relative w-full max-w-md rounded-xl border border-fo-border bg-fo-surface p-5 shadow-[0_8px_24px_rgba(26,22,18,0.08)]"
          >
            <h3 className="text-lg font-semibold text-fo-text">Contact seller</h3>
            <p className="mt-1 text-sm text-fo-subtle">
              Send a message to {listing.seller?.name || "the seller"}. They
              will get it in Messages with a link to this listing.
            </p>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-xl border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text resize-y focus:outline-none focus:border-fo-accent/50"
              placeholder="Hi, is this still available?"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="min-h-9 px-3 text-sm text-fo-muted hover:text-fo-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={contacting}
                className="inline-flex items-center gap-2 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold disabled:opacity-60"
              >
                {contacting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Send message
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ListingFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        submitting={submitting}
        initial={listing}
        title="Edit listing"
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete listing?"
        variant="post"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      >
        This listing will be removed from the marketplace. This cannot be
        undone.
      </ConfirmDeleteModal>

      <ReportContentModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={listing.id}
        targetLabel={listing.title}
      />
    </div>
  );
}
