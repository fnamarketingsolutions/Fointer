import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
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
import UserProfileLink from "../../../shared/components/UserProfileLink";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import ListingFormModal from "../components/ListingFormModal";
import {
  categoryLabel,
  conditionLabel,
  formatLocation,
  formatPrice,
} from "../constants";
import { timeAgo } from "../../../shared/utils/date";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";

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
      const res = await contactSeller(listing.id, { message: contactMessage.trim() });
      setContactOpen(false);
      setContactMessage("");
      const conversationId = res?.conversationId;
      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      } else {
        showToast("Message sent to seller.");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setContacting(false);
    }
  };

  const handleMarkSold = async () => {
    if (!window.confirm("Mark this listing as sold?")) return;
    try {
      const res = await markListingSold(listing.id);
      setListing(res?.listing || listing);
      showToast("Listing marked as sold.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update listing.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this listing permanently?")) return;
    try {
      await deleteListing(listing.id);
      showToast("Listing deleted.");
      navigate("/marketplace/my-listings", { replace: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete listing.");
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

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-fo-muted">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!listing) return null;

  const media = listing.media || [];
  const current = media[activeImage];
  const location = formatLocation(listing);
  const isSold = listing.status === "sold";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <button
        type="button"
        onClick={() => navigate("/marketplace")}
        className="inline-flex items-center gap-2 text-sm text-fo-muted hover:text-fo-text mb-6"
      >
        <ArrowLeft size={16} /> Back to Marketplace
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square rounded-2xl border border-fo-border bg-fo-bg overflow-hidden">
            {current ? (
              current.type === "video" ? (
                <video
                  src={current.url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={current.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-fo-subtle text-sm">
                No photos
              </div>
            )}
          </div>
          {media.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {media.map((m, idx) => (
                <button
                  key={`${m.url}-${idx}`}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`shrink-0 w-16 h-16 rounded-lg border overflow-hidden ${
                    idx === activeImage
                      ? "border-fo-accent"
                      : "border-fo-border"
                  }`}
                >
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {isSold ? (
            <span className="inline-block px-2 py-0.5 rounded-md bg-fo-muted/20 text-fo-muted text-xs font-semibold uppercase tracking-wide mb-3">
              Sold
            </span>
          ) : null}
          <p className="text-3xl font-semibold text-fo-text">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <h1 className="mt-2 text-xl font-semibold text-fo-text leading-snug">
            {listing.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fo-muted">
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {location}
              </span>
            ) : null}
            <span>{categoryLabel(listing.category)}</span>
            <span>· {conditionLabel(listing.condition)}</span>
            <span>· Listed {timeAgo(listing.createdAt)}</span>
          </div>

          {listing.description ? (
            <p className="mt-6 text-sm text-fo-muted leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          ) : null}

          <div className="mt-8 rounded-xl border border-fo-border bg-fo-surface p-4">
            <p className="text-[10px] uppercase tracking-wider text-fo-subtle mb-3">
              Seller
            </p>
            <div className="flex items-center gap-3">
              <ProfileAvatar
                src={listing.seller?.avatar}
                name={listing.seller?.name}
                className="w-11 h-11 rounded-full object-cover border border-fo-border shrink-0"
              />
              <div className="min-w-0">
                <UserProfileLink
                  author={listing.seller}
                  className="font-medium text-fo-text hover:text-fo-accent"
                >
                  {listing.seller?.name || listing.seller?.username}
                </UserProfileLink>
                {formatLocation(listing.seller) ? (
                  <p className="text-xs text-fo-muted mt-0.5">
                    {formatLocation(listing.seller)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-fo-border/60 bg-fo-bg/50 p-4">
            <p className="text-xs text-fo-subtle leading-relaxed">
              Fointer does not process payments, seller payouts, escrow, or
              shipping. Arrange payment and delivery directly with the seller.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-fo-accent text-fo-bg text-sm font-medium"
                >
                  <MessageCircle size={16} /> Contact seller
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-fo-border text-sm text-fo-muted hover:text-red-400"
                >
                  <Flag size={16} /> Report
                </button>
              </>
            ) : null}

            {listing.canEdit ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-fo-border text-sm text-fo-text hover:border-fo-accent/40"
              >
                <Pencil size={16} /> Edit
              </button>
            ) : null}

            {listing.canMarkSold ? (
              <button
                type="button"
                onClick={handleMarkSold}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-fo-border text-sm text-fo-text hover:border-fo-accent/40"
              >
                Mark as sold
              </button>
            ) : null}

            {listing.canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} /> Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {contactOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setContactOpen(false)}
            aria-label="Close"
          />
          <form
            onSubmit={handleContact}
            className="relative w-full max-w-md rounded-2xl border border-fo-border bg-fo-surface p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-fo-text">Contact seller</h3>
            <p className="mt-2 text-sm text-fo-muted">
              Send a message to {listing.seller?.name || "the seller"}. They will
              receive it in their Messages inbox with a link to this listing.
            </p>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text resize-y"
              placeholder="Hi, is this still available?"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="px-4 py-2 text-sm text-fo-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={contacting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-fo-bg text-sm font-medium disabled:opacity-60"
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
