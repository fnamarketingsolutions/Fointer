import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuFlag as Flag,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuPencil as Pencil,
  LuRefreshCw as RefreshCw,
  LuRotateCcw as RotateCcw,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
  LuTrash2 as Trash2,
  LuX as X,
} from "react-icons/lu";
import {
  fetchAdminConversationMessages,
  fetchAdminMarketplaceListings,
  fetchAdminReportedConversations,
  removeAdminMarketplaceListing,
  restoreAdminMarketplaceListing,
  updateAdminMarketplaceListing,
  warnAdminMarketplaceSeller,
} from "../../../../api/dashboard";
import { LISTING_CATEGORIES, formatPrice } from "../../../marketplace/constants";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "sold", label: "Sold" },
  { id: "draft", label: "Draft" },
  { id: "removed", label: "Removed" },
];

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/30",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
    primary:
      "border border-fo-accent/35 text-fo-accent hover:bg-fo-accent/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function MarketplaceManagement() {
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
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [reportedConversations, setReportedConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convMessages, setConvMessages] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

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

  const openEdit = (listing) => {
    setSelected(listing);
    setEditForm({
      title: listing.title || "",
      description: listing.description || "",
      price: listing.price ?? "",
      status: listing.status || "active",
    });
  };

  const handleSave = async () => {
    if (!selected || !editForm) return;
    setBusyId(selected.id);
    try {
      await updateAdminMarketplaceListing(selected.id, {
        ...editForm,
        price: Number(editForm.price),
      });
      showToast("Listing updated.");
      setSelected(null);
      setEditForm(null);
      await loadListings();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update listing."));
    } finally {
      setBusyId(null);
    }
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

  const handleWarn = async (listing) => {
    const message = window.prompt(
      "Warning message for the seller:",
      "Your listing may violate Fointer marketplace policies. Please review and update it."
    );
    if (!message?.trim()) return;
    setBusyId(listing.id);
    try {
      await warnAdminMarketplaceSeller(listing.id, { message: message.trim() });
      showToast("Warning sent.");
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to send warning."));
    } finally {
      setBusyId(null);
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

  const visibleListings = useMemo(() => listings, [listings]);

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
          ) : visibleListings.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No listings found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleListings.map((listing) => (
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
                    <ActionBtn onClick={() => openEdit(listing)}>
                      <Pencil size={12} /> Edit
                    </ActionBtn>
                    {listing.status !== "removed" ? (
                      <ActionBtn
                        tone="danger"
                        disabled={busyId === listing.id}
                        onClick={() => handleRemove(listing)}
                      >
                        <Trash2 size={12} /> Remove
                      </ActionBtn>
                    ) : (
                      <ActionBtn
                        disabled={busyId === listing.id}
                        onClick={() => handleRestore(listing)}
                      >
                        <RotateCcw size={12} /> Restore
                      </ActionBtn>
                    )}
                    <ActionBtn onClick={() => handleWarn(listing)}>
                      <Flag size={12} /> Warn seller
                    </ActionBtn>
                    <Link
                      to={`/marketplace/${listing.shortCode || listing.id}`}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent"
                    >
                      View
                    </Link>
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
              <ActionBtn onClick={() => openConversation(item.conversationId)}>
                <MessageCircle size={12} /> Review messages
              </ActionBtn>
            </article>
          ))}
        </div>
      )}

      {selected && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-fo-surface border border-fo-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit listing</h2>
              <button type="button" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
              placeholder="Title"
            />
            <textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm resize-y"
              placeholder="Description"
            />
            <input
              type="number"
              value={editForm.price}
              onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
            />
            <select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
            >
              {STATUS_FILTERS.filter((s) => s.id !== "all").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSave}
              disabled={busyId === selected.id}
              className="w-full py-2.5 rounded-xl bg-fo-accent text-black text-sm font-semibold"
            >
              Save changes
            </button>
          </div>
        </div>
      ) : null}

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
    </div>
  );
}
