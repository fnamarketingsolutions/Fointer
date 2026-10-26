import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LuLoaderCircle as Loader2, LuShare2 as Share2 } from "react-icons/lu";
import { fetchListings } from "../../../api/marketplace";
import { useAuth } from "../../../context/AuthContext";
import ShareSheetModal from "../../../shared/components/modals/ShareSheetModal";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import { getErrorMessage } from "../../../shared/utils/errors";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import ListingCard from "../../marketplace/components/ListingCard";
import { categoryLabel, formatLocation } from "../../marketplace/constants";
import {
  fetchStoreBySlug,
  followStore,
  messageStore,
  unfollowStore,
} from "../services/storeService";

export default function Storefront() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState("");
  const [missing, setMissing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storeRes = await fetchStoreBySlug(slug);
        const listingRes = await fetchListings({ store: slug, page: 1, limit: 48 });
        if (cancelled) return;
        setStore(storeRes?.store || null);
        setProducts(listingRes?.listings || []);
        setMissing(false);
        setLoadedFor(slug);
      } catch (error) {
        if (cancelled) return;
        setStore(null);
        setProducts([]);
        setMissing(error?.response?.status === 404);
        setLoadedFor(slug);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visible = useMemo(() => {
    if (!section) return products;
    return products.filter((listing) => String(listing.storeCategory?.id || "") === section);
  }, [products, section]);

  if (loading || loadedFor !== slug) return <PageLoader minHeight="min-h-[40vh]" />;
  if (!store) {
    return (
      <p className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-fo-subtle">
        {missing ? "This store is not available." : "Could not load this store."}
      </p>
    );
  }

  const place = formatLocation(store);
  const requireAccount = () => {
    navigate("/login", { state: { from: location.pathname } });
  };
  const toggleFollow = async () => {
    if (!user) {
      requireAccount();
      return;
    }
    setFollowing(true);
    try {
      const result = store.followedByMe
        ? await unfollowStore(store.id)
        : await followStore(store.id);
      setStore(result?.store || store);
    } catch (error) {
      showToast(getErrorMessage(error, "Could not update follow."));
    } finally {
      setFollowing(false);
    }
  };
  const sendMessage = async (event) => {
    event.preventDefault();
    if (!user) {
      requireAccount();
      return;
    }
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const result = await messageStore(store.id, text);
      if (result?.conversationId) {
        navigate(`/messages/${result.conversationId}`);
        return;
      }
      setMessage("");
      setMessageOpen(false);
      showToast("Message sent.");
    } catch (error) {
      showToast(getErrorMessage(error, "Could not send message."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-10 text-fo-text">
      <section className="rounded-2xl border border-fo-border bg-fo-surface">
        <div className="relative h-40 overflow-hidden rounded-t-2xl bg-fo-bg sm:h-56">
          {store.coverImage ? (
            <img
              src={displayImageUrl(store.coverImage, 1200)}
              alt=""
              className="absolute inset-0 h-full w-full rounded-t-2xl object-cover"
            />
          ) : (
            <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-br from-fo-accent/20 via-fo-surface to-fo-bg" />
          )}
          <div className="absolute bottom-4 left-4 z-10 h-20 w-20 overflow-hidden rounded-2xl border-4 border-fo-surface bg-fo-bg shadow-md sm:left-6">
            {store.logo ? (
              <img
                src={displayImageUrl(store.logo, 160)}
                alt={`${store.name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-fo-accent">
                {store.name?.trim()?.charAt(0)?.toUpperCase() || "S"}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-b-2xl px-4 py-5 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-fo-subtle">
              {categoryLabel(store.category)}
              {place ? ` · ${place}` : ""}
              {` · ${store.followerCount || 0} followers`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {store.isOwner ? (
              <Link
                to={`/stores/manage/${store.id}`}
                className="inline-flex min-h-9 items-center rounded-full border border-fo-border px-4 text-xs font-medium hover:border-fo-accent/40"
              >
                Manage
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={following}
                  className={`inline-flex min-h-9 items-center rounded-full px-4 text-xs font-semibold disabled:opacity-60 ${
                    store.followedByMe
                      ? "border border-fo-border text-fo-text"
                      : "bg-fo-accent text-black"
                  }`}
                >
                  {following ? <Loader2 size={12} className="animate-spin" /> : store.followedByMe ? "Following" : "Follow"}
                </button>
                <button
                  type="button"
                  onClick={() => (user ? setMessageOpen(true) : requireAccount())}
                  className="inline-flex min-h-9 items-center rounded-full border border-fo-border px-4 text-xs font-medium"
                >
                  Message
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-fo-border px-4 text-xs font-medium"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
      </section>

      {store.status === "suspended" ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
          This store is suspended and hidden from shoppers.
        </p>
      ) : null}

      {messageOpen ? (
        <form onSubmit={sendMessage} className="mt-4 rounded-xl border border-fo-border bg-fo-surface p-3">
          <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
            Message {store.name}
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
            placeholder="Ask about a product"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMessageOpen(false)} className="text-xs text-fo-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-full bg-fo-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : null}
              Send
            </button>
          </div>
        </form>
      ) : null}

      {store.description || store.contactPhone || store.contactEmail ? (
        <section className="mt-4 rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5">
          {store.description ? (
            <>
              <h2 className="text-sm font-semibold">About this store</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fo-muted">
                {store.description}
              </p>
            </>
          ) : null}
          {store.contactPhone || store.contactEmail ? (
            <div
              className={`flex flex-wrap gap-x-4 gap-y-2 text-xs text-fo-subtle ${
                store.description ? "mt-4 border-t border-fo-border pt-3" : ""
              }`}
            >
              {store.contactPhone ? (
                <a href={`tel:${store.contactPhone}`} className="hover:text-fo-accent">
                  {store.contactPhone}
                </a>
              ) : null}
              {store.contactEmail ? (
                <a href={`mailto:${store.contactEmail}`} className="break-all hover:text-fo-accent">
                  {store.contactEmail}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {(store.categories || []).length ? (
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter products by section">
          <button
            type="button"
            onClick={() => setSection("")}
            className={`rounded-full px-3 py-1 text-xs ${section ? "border border-fo-border text-fo-muted" : "bg-fo-accent text-black"}`}
          >
            All
          </button>
          {store.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSection(category.id)}
              className={`rounded-full px-3 py-1 text-xs ${
                section === category.id ? "bg-fo-accent text-black" : "border border-fo-border text-fo-muted"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {section
              ? store.categories?.find((category) => category.id === section)?.name || "Products"
              : "Products"}
          </h2>
          <span className="text-xs text-fo-subtle">{visible.length} items</span>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-fo-border bg-fo-surface px-4 py-12 text-center">
            <p className="text-sm font-medium text-fo-text">No products here yet</p>
            <p className="mt-1 text-xs text-fo-subtle">
              {section
                ? "Try another section or check back later."
                : "This store has not added any products yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
      <ShareSheetModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={store.name}
        text={String(store.description || "").replace(/\s+/g, " ").trim().slice(0, 140)}
        url={`${window.location.origin}/store/${store.slug}`}
      />
    </div>
  );
}
