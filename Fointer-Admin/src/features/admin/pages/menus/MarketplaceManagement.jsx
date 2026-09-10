import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuPencil as Pencil,
  LuRefreshCw as RefreshCw,
  LuRotateCcw as RotateCcw,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
  LuTrash2 as Trash2,
  LuTriangleAlert as AlertTriangle,
  LuX as X,
} from "react-icons/lu";
import {
  fetchAdminConversationMessages,
  fetchAdminMarketplaceListings,
  fetchAdminReportedConversations,
  fetchWarningPolicy,
  removeAdminMarketplaceListing,
  restoreAdminMarketplaceListing,
  warnAdminMarketplaceSeller,
} from "../../../../api/dashboard";
import { formatPrice } from "../../../marketplace/constants";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import AdminActionBtn from "../../../../shared/components/AdminActionBtn";
import WarnUserModal from "../../../../shared/components/modals/WarnUserModal";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "sold", label: "Sold" },
  { id: "draft", label: "Draft" },
  { id: "hidden", label: "Hidden" },
  { id: "removed", label: "Removed" },
];

export default function MarketplaceManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState("listings");
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [reportedConversations, setReportedConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convMessages, setConvMessages] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnPolicy, setWarnPolicy] = useState({
    maxWarningsBeforeBan: 3,
    autoBanOnMaxWarnings: true,
  });

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminMarketplaceListings({
        status: status === "all" ? undefined : status,
        q: query.trim() || undefined,
        reported: reportedOnly ? "true" : undefined,
      });
      setListings(data?.listings || []);
      setSummary(data?.summary || {});
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load listings."));
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [status, query, reportedOnly, showToast]);

  const loadReportedConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const data = await fetchAdminReportedConversations();
      setReportedConversations(data?.reportedConversations || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load reported conversations."));
      setReportedConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === "listings") loadListings();
    else loadReportedConversations();
  }, [tab, loadListings, loadReportedConversations]);

  useEffect(() => {
    fetchWarningPolicy()
      .then((data) => {
        if (!data?.policy) return;
        setWarnPolicy({
          maxWarningsBeforeBan: data.policy.maxWarningsBeforeBan ?? 3,
          autoBanOnMaxWarnings: data.policy.autoBanOnMaxWarnings !== false,
        });
      })
      .catch(() => {});
  }, []);

  const openListing = (listing, { edit = false } = {}) => {
    const id = listing.shortCode || listing.id;
    navigate(edit ? `/marketplace/${id}?edit=1` : `/marketplace/${id}`);
  };

  const handleRemove = async (listing) => {
    if (!window.confirm(`Remove "${listing.title}" from marketplace?`)) return;
    setBusyId(listing.id);
    try {
      await removeAdminMarketplaceListing(listing.id);
      showToast("Listing removed.");
      await loadListings();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to remove listing."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (listing) => {
    setBusyId(listing.id);
    try {
      await restoreAdminMarketplaceListing(listing.id);
      showToast("Listing restored.");
      await loadListings();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to restore listing."));
    } finally {
      setBusyId(null);
    }
  };

  const handleWarn = async (message) => {
    if (!warnTarget?.id) return;
    setWarnSaving(true);
    try {
      const data = await warnAdminMarketplaceSeller(warnTarget.id, {
        message: message.trim(),
      });
      showToast(data?.message || "Warning sent.");
      setWarnTarget(null);
      await loadListings();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to send warning."));
    } finally {
      setWarnSaving(false);
    }
  };

  const openConversation = async (conversationId) => {
    setActiveConversationId(conversationId);
    setConvMessages([]);
    try {
      const data = await fetchAdminConversationMessages(conversationId);
      setConvMessages(data?.messages || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load messages."));
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text flex items-center gap-2">
            <ShoppingBag size={20} className="text-fo-accent" />
            Marketplace
          </h1>
          <p className="text-sm text-fo-subtle mt-1">
            Moderate listings and review reported conversations.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            tab === "listings" ? loadListings() : loadReportedConversations()
          }
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
        >
          <RefreshCw size={16} className={loading || convLoading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border">
        {[
          { id: "listings", label: "Listings" },
          { id: "conversations", label: "Reported chats" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
              tab === item.id
                ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                : "text-fo-subtle"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "listings" ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search listings..."
                className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-fo-border text-xs text-fo-muted">
              <input
                type="checkbox"
                checked={reportedOnly}
                onChange={(e) => setReportedOnly(e.target.checked)}
              />
              Reported only
            </label>
          </form>

          <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  status === item.id
                    ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                    : "text-fo-subtle"
                }`}
              >
                {item.label}
                {summary[item.id] != null ? ` (${summary[item.id]})` : ""}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 size={18} className="animate-spin text-fo-accent" />
            </div>
          ) : listings.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No listings found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {listings.map((listing) => (
                <article
                  key={listing.id}
                  className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fo-text truncate">
                        {listing.title}
                      </p>
                      <p className="text-xs text-fo-accent font-semibold">
                        {formatPrice(listing.price, listing.currency)}
                      </p>
                      <p className="text-[11px] text-fo-subtle mt-1">
                        {listing.status} · {listing.seller?.username || "seller"}
                        {listing.sellerStatus !== "active" ? (
                          <span className="text-red-400"> · {listing.sellerStatus}</span>
                        ) : null}
                        {listing.pendingReports > 0 ? (
                          <span className="text-red-400">
                            {" "}
                            · {listing.pendingReports} report(s)
                          </span>
                        ) : null}
                        {" · "}
                        {timeAgo(listing.createdAt)}
                      </p>
                    </div>
                    {listing.media?.[0]?.url ? (
                      <img
                        src={listing.media[0].url}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-fo-border shrink-0"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AdminActionBtn onClick={() => openListing(listing, { edit: true })}>
                      <Pencil size={12} /> Edit
                    </AdminActionBtn>
                    {listing.status !== "removed" ? (
                      <AdminActionBtn
                        tone="danger"
                        disabled={busyId === listing.id}
                        onClick={() => handleRemove(listing)}
                      >
                        <Trash2 size={12} /> Remove
                      </AdminActionBtn>
                    ) : null}
                    {listing.status === "removed" ||
                    listing.status === "hidden" ? (
                      <AdminActionBtn
                        disabled={busyId === listing.id}
                        onClick={() => handleRestore(listing)}
                      >
                        <RotateCcw size={12} /> Restore
                      </AdminActionBtn>
                    ) : null}
                    <AdminActionBtn
                      onClick={() =>
                        setWarnTarget({
                          id: listing.id,
                          name:
                            listing.seller?.name ||
                            listing.seller?.username ||
                            "Seller",
                          username: listing.seller?.username || "",
                          warningCount: listing.seller?.warningCount || 0,
                        })
                      }
                    >
                      <AlertTriangle size={12} /> Warn seller
                    </AdminActionBtn>
                    <AdminActionBtn
                      tone="primary"
                      onClick={() => openListing(listing)}
                    >
                      View
                    </AdminActionBtn>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : convLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 size={18} className="animate-spin text-fo-accent" />
        </div>
      ) : reportedConversations.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No reported conversations.
        </div>
      ) : (
        <div className="space-y-2.5">
          {reportedConversations.map((item) => (
            <article
              key={item.reportId}
              className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2"
            >
              <p className="text-sm font-semibold text-fo-text">
                {item.snapshot?.authorName || "Reported user"}
              </p>
              <p className="text-xs text-fo-muted">
                Reason: {item.reason} · {timeAgo(item.createdAt)}
              </p>
              {item.details ? (
                <p className="text-xs text-fo-subtle">{item.details}</p>
              ) : null}
              <AdminActionBtn onClick={() => openConversation(item.conversationId)}>
                <MessageCircle size={12} /> Review messages
              </AdminActionBtn>
            </article>
          ))}
        </div>
      )}

      {activeConversationId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75"
            onClick={() => setActiveConversationId(null)}
          />
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto bg-fo-surface border border-fo-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Reported conversation</h2>
              <button type="button" onClick={() => setActiveConversationId(null)}>
                <X size={18} />
              </button>
            </div>
            {convMessages.length === 0 ? (
              <p className="text-sm text-fo-subtle">No messages loaded.</p>
            ) : (
              convMessages.map((msg) => (
                <div key={msg.id} className="rounded-lg border border-fo-border p-3 text-sm">
                  <p className="text-[11px] text-fo-subtle mb-1">
                    {msg.author?.name || msg.author?.username} · {timeAgo(msg.createdAt)}
                  </p>
                  <p className="text-fo-text whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <WarnUserModal
        open={Boolean(warnTarget)}
        user={warnTarget}
        loading={warnSaving}
        warningCount={warnTarget?.warningCount || 0}
        maxWarningsBeforeBan={warnPolicy.maxWarningsBeforeBan}
        autoBanOnMaxWarnings={warnPolicy.autoBanOnMaxWarnings}
        onClose={() => {
          if (warnSaving) return;
          setWarnTarget(null);
        }}
        onSubmit={handleWarn}
      />
    </div>
  );
}
