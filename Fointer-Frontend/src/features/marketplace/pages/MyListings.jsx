import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuSparkles as Sparkles,
  LuWallet as Wallet,
  LuX as X,
} from "react-icons/lu";
import {
  createListing,
  deleteListing,
  fetchMyListings,
  fetchMyCommunitySponsoredEarnings,
  fetchMySponsorships,
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
import { listingSegment } from "../../../shared/services/entityLinks";

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

const formatWhen = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
};

const formatMoney = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || ""} ${amount}`;
  }
};

const statusTone = (status) => {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/25";
  if (status === "pending") return "bg-amber-500/10 text-amber-600 border-amber-500/25";
  if (status === "failed" || status === "refunded" || status === "reversed") {
    return "bg-red-500/10 text-red-500 border-red-500/25";
  }
  return "bg-fo-bg text-fo-subtle border-fo-border";
};

function DetailSheet({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-fo-border bg-fo-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-fo-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-sm text-fo-text">{children}</div>
        {footer ? <div className="mt-5 pt-4 border-t border-fo-border">{footer}</div> : null}
      </div>
    </div>
  );
}

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between gap-3 text-xs">
    <span className="text-fo-subtle shrink-0">{label}</span>
    <span className="text-right font-medium text-fo-text break-all">{value || "—"}</span>
  </div>
);

export default function MyListings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [listings, setListings] = useState([]);
  const [sponsorships, setSponsorships] = useState([]);
  const [communityEarnings, setCommunityEarnings] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [panel, setPanel] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedEarning, setSelectedEarning] = useState(null);
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
      try {
        const promotionHistory = await fetchMySponsorships();
        setSponsorships(promotionHistory?.purchases || []);
      } catch (error) {
        showToast(error?.response?.data?.message || "Failed to load promotion history.");
      }
      try {
        const earnings = await fetchMyCommunitySponsoredEarnings();
        setCommunityEarnings(earnings?.earnings || []);
        setEarningsSummary(earnings?.summary || null);
      } catch (error) {
        showToast(error?.response?.data?.message || "Failed to load community earnings.");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    const payment = searchParams.get("payment");
    if (!transactionId && payment !== "pending") return undefined;
    const params = new URLSearchParams(searchParams);
    navigate(`/marketplace/promote/success?${params.toString()}`, { replace: true });
    return undefined;
  }, [searchParams, navigate]);

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

  const pendingPromoCount = useMemo(
    () => sponsorships.filter((row) => row.paymentStatus === "pending").length,
    [sponsorships]
  );

  const togglePanel = (id) => {
    setPanel((current) => (current === id ? null : id));
    setSelectedPurchase(null);
    setSelectedEarning(null);
  };

  const completePending = (purchase) => {
    if (purchase?.canCompletePayment && purchase.paymentLink) {
      window.location.assign(purchase.paymentLink);
      return;
    }
    if (purchase?.listing?.id || purchase?.listing?.shortCode) {
      navigate(
        `/marketplace/promote/${purchase.listing.shortCode || purchase.listing.id}`
      );
      return;
    }
    showToast(
      "This pending checkout has no payment link and the listing is gone. Wait for it to expire, or contact support."
    );
  };

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      const res = await createListing(payload);
      showToast("Listing created.");
      setModalOpen(false);
      const segment = listingSegment(res?.listing);
      if (segment) navigate(`/marketplace/${segment}`);
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fo-text leading-tight">
                My listings
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug">
                Create, edit, and manage what you are selling.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => togglePanel("promotions")}
                aria-pressed={panel === "promotions"}
                className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-[13px] font-semibold transition-colors ${
                  panel === "promotions"
                    ? "border-fo-accent bg-fo-accent/10 text-fo-accent"
                    : "border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                }`}
              >
                <Sparkles size={14} />
                Promotions
                {sponsorships.length ? (
                  <span className="tabular-nums text-[11px] opacity-80">
                    {sponsorships.length}
                    {pendingPromoCount ? ` · ${pendingPromoCount} pending` : ""}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => togglePanel("earnings")}
                aria-pressed={panel === "earnings"}
                className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-[13px] font-semibold transition-colors ${
                  panel === "earnings"
                    ? "border-fo-accent bg-fo-accent/10 text-fo-accent"
                    : "border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                }`}
              >
                <Wallet size={14} />
                Earnings
                {earningsSummary?.totalsByCurrency?.[0] ? (
                  <span className="tabular-nums text-[11px] opacity-80">
                    {formatMoney(
                      earningsSummary.totalsByCurrency[0].net,
                      earningsSummary.totalsByCurrency[0].currency
                    )}
                  </span>
                ) : communityEarnings.length ? (
                  <span className="tabular-nums text-[11px] opacity-80">
                    {communityEarnings.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover"
              >
                <Plus size={16} aria-hidden /> New listing
              </button>
            </div>
          </div>

          {panel === "promotions" ? (
            <section className="rounded-2xl border border-fo-border bg-fo-surface p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Promotion history</h2>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="text-xs text-fo-subtle hover:text-fo-accent"
                >
                  Close
                </button>
              </div>
              {!sponsorships.length ? (
                <p className="text-xs text-fo-subtle py-4 text-center">
                  No promotions yet. Promote an active listing to get more visibility.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sponsorships.map((purchase) => (
                    <li key={purchase.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPurchase(purchase)}
                        className="w-full text-left rounded-xl border border-fo-border bg-fo-bg/50 p-3 hover:border-fo-accent/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {purchase.listing?.title || "Listing unavailable"}
                            </p>
                            <p className="text-xs text-fo-subtle mt-0.5">
                              {purchase.package?.name || "Promotion"}
                              {purchase.community?.name
                                ? ` · ${purchase.community.name}`
                                : " · platform-wide"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(
                              purchase.paymentStatus
                            )}`}
                          >
                            {purchase.paymentStatus}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-fo-subtle">
                          {formatMoney(purchase.amount, purchase.currency)}
                          {purchase.isLive
                            ? ` · active until ${formatWhen(purchase.expiresAt)}`
                            : purchase.isQueued
                              ? ` · starts ${formatWhen(purchase.startsAt)}`
                              : purchase.expiresAt
                                ? ` · ends ${formatWhen(purchase.expiresAt)}`
                                : ` · ${formatWhen(purchase.createdAt)}`}
                        </p>
                        {purchase.paymentStatus === "pending" ? (
                          <span className="mt-2 inline-flex text-[11px] font-semibold text-fo-accent">
                            Tap for details · Complete payment available
                          </span>
                        ) : (
                          <span className="mt-2 inline-flex text-[11px] text-fo-subtle">
                            Tap for details
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {panel === "earnings" ? (
            <section className="rounded-2xl border border-fo-border bg-fo-surface p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Community promotion earnings</h2>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="text-xs text-fo-subtle hover:text-fo-accent"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-fo-subtle">
                Your total commission when sellers promote with your community.
                Ledger only — no automatic payout.
              </p>
              {earningsSummary?.totalsByCurrency?.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {earningsSummary.totalsByCurrency.map((row) => (
                    <div
                      key={row.currency}
                      className="rounded-xl border border-fo-accent/25 bg-fo-accent/5 p-3"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-fo-accent">
                        Total earned · {row.currency}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-fo-text">
                        {formatMoney(row.net, row.currency)}
                      </p>
                      <p className="mt-1 text-[11px] text-fo-subtle">
                        {row.earnedCount} paid
                        {row.reversedCount
                          ? ` · ${row.reversedCount} reversed`
                          : ""}
                        {" · "}
                        {formatMoney(row.gross, row.currency)} boost fees
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {earningsSummary?.byCommunity?.length ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-fo-muted">By community</p>
                  <ul className="space-y-1">
                    {earningsSummary.byCommunity.map((row) => (
                      <li
                        key={`${row.community?.id}-${row.currency}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-fo-border px-3 py-2 text-xs"
                      >
                        <span className="truncate text-fo-text">
                          {row.community?.name || "Community"}
                          <span className="text-fo-subtle"> · {row.count}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-fo-accent tabular-nums">
                          {formatMoney(row.commission, row.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!communityEarnings.length ? (
                <p className="text-xs text-fo-subtle py-4 text-center">
                  No community earnings yet. Earnings appear when someone promotes with
                  your community attributed.
                </p>
              ) : (
                <ul className="space-y-2">
                  <li className="text-[11px] font-semibold text-fo-muted pt-1">
                    Recent ledger
                  </li>
                  {communityEarnings.map((earning) => (
                    <li key={earning.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedEarning(earning)}
                        className="w-full text-left rounded-xl border border-fo-border bg-fo-bg/50 p-3 hover:border-fo-accent/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {earning.community?.name || "Community"}
                            </p>
                            <p className="text-xs text-fo-subtle mt-0.5">
                              {earning.percentUsed}% of{" "}
                              {formatMoney(earning.gross, earning.currency)}
                              {earning.purchase?.listing?.title
                                ? ` · ${earning.purchase.listing.title}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(
                              earning.status
                            )}`}
                          >
                            {earning.status}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-fo-accent">
                          {formatMoney(earning.commissionAmount, earning.currency)}{" "}
                          <span className="font-normal text-fo-subtle">commission</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

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
                      <>
                        <button
                          type="button"
                          onClick={() => handleMarkSold(listing)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                        >
                          Mark sold
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/marketplace/promote/${listing.shortCode || listing.id}`
                            )
                          }
                          className="text-xs px-2.5 py-1 rounded-lg border border-fo-accent/40 text-fo-accent hover:bg-fo-accent/10"
                        >
                          {listing.isSponsored ? "Extend" : "Promote"}
                        </button>
                        {listing.isSponsored && listing.sponsorship?.expiresAt ? (
                          <span className="text-[10px] text-fo-subtle px-1 py-1">
                            Boosted until{" "}
                            {new Date(
                              listing.sponsorship.expiresAt
                            ).toLocaleDateString()}
                          </span>
                        ) : null}
                      </>
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

      <DetailSheet
        open={Boolean(selectedPurchase)}
        title="Promotion details"
        onClose={() => setSelectedPurchase(null)}
        footer={
          selectedPurchase?.paymentStatus === "pending" ? (
            <button
              type="button"
              onClick={() => completePending(selectedPurchase)}
              className="w-full min-h-11 rounded-xl bg-fo-accent text-black text-sm font-semibold"
            >
              {selectedPurchase.canCompletePayment
                ? "Complete payment"
                : selectedPurchase.listing
                  ? "Continue promote checkout"
                  : "Cannot complete"}
            </button>
          ) : selectedPurchase?.listing ? (
            <button
              type="button"
              onClick={() => {
                const segment =
                  listingSegment(selectedPurchase.listing) ||
                  selectedPurchase.listing.shortCode ||
                  selectedPurchase.listing.id;
                navigate(`/marketplace/${segment}`);
              }}
              className="w-full min-h-11 rounded-xl border border-fo-border text-sm font-semibold text-fo-muted hover:text-fo-accent"
            >
              View listing
            </button>
          ) : null
        }
      >
        {selectedPurchase ? (
          <>
            <DetailRow
              label="Listing"
              value={selectedPurchase.listing?.title || "Listing unavailable"}
            />
            <DetailRow label="Package" value={selectedPurchase.package?.name} />
            <DetailRow
              label="Fee"
              value={formatMoney(selectedPurchase.amount, selectedPurchase.currency)}
            />
            <DetailRow label="Status" value={selectedPurchase.paymentStatus} />
            <DetailRow
              label="Community"
              value={selectedPurchase.community?.name || "Platform-wide (no owner cut)"}
            />
            <DetailRow
              label="Location"
              value={
                [
                  selectedPurchase.geo?.cities?.[0],
                  selectedPurchase.geo?.states?.[0],
                  selectedPurchase.geo?.countries?.[0],
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <DetailRow label="Starts" value={formatWhen(selectedPurchase.startsAt)} />
            <DetailRow
              label="Active until"
              value={formatWhen(selectedPurchase.expiresAt)}
            />
            <DetailRow label="Created" value={formatWhen(selectedPurchase.createdAt)} />
            <DetailRow
              label="Reference"
              value={selectedPurchase.providerReference}
            />
            {selectedPurchase.placement ? (
              <DetailRow
                label="Placement"
                value={[
                  selectedPurchase.placement.top && "top",
                  selectedPurchase.placement.section && "section",
                  selectedPurchase.placement.badge && "badge",
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              />
            ) : null}
            {selectedPurchase.isLive ? (
              <p className="text-xs text-emerald-600 font-medium pt-1">
                Currently live on marketplace.
              </p>
            ) : null}
            {selectedPurchase.isQueued ? (
              <p className="text-xs text-fo-accent font-medium pt-1">
                Queued — starts after the current boost ends.
              </p>
            ) : null}
          </>
        ) : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedEarning)}
        title="Earnings details"
        onClose={() => setSelectedEarning(null)}
        footer={
          selectedEarning?.purchase?.listing ? (
            <button
              type="button"
              onClick={() => {
                const listing = selectedEarning.purchase.listing;
                const segment =
                  listingSegment(listing) || listing.shortCode || listing.id;
                navigate(`/marketplace/${segment}`);
              }}
              className="w-full min-h-11 rounded-xl border border-fo-border text-sm font-semibold text-fo-muted hover:text-fo-accent"
            >
              View listing
            </button>
          ) : null
        }
      >
        {selectedEarning ? (
          <>
            <DetailRow
              label="Community"
              value={selectedEarning.community?.name || "Community"}
            />
            <DetailRow
              label="Gross boost fee"
              value={formatMoney(selectedEarning.gross, selectedEarning.currency)}
            />
            <DetailRow label="Commission rate" value={`${selectedEarning.percentUsed}%`} />
            <DetailRow
              label="Your commission"
              value={formatMoney(
                selectedEarning.commissionAmount,
                selectedEarning.currency
              )}
            />
            <DetailRow label="Status" value={selectedEarning.status} />
            <DetailRow
              label="Listing"
              value={
                selectedEarning.purchase?.listing?.title || "Listing unavailable"
              }
            />
            <DetailRow
              label="Package"
              value={selectedEarning.purchase?.packageName || "Promotion"}
            />
            <DetailRow
              label="Boost window"
              value={
                selectedEarning.purchase?.startsAt
                  ? `${formatWhen(selectedEarning.purchase.startsAt)} → ${formatWhen(
                      selectedEarning.purchase.expiresAt
                    )}`
                  : "—"
              }
            />
            <DetailRow label="Recorded" value={formatWhen(selectedEarning.createdAt)} />
            <p className="text-[11px] text-fo-subtle pt-1">
              Ledger only — Fointer does not auto-payout community owners in Phase 2.
            </p>
          </>
        ) : null}
      </DetailSheet>

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
