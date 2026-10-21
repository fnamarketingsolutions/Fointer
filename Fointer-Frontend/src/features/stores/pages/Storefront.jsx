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
      <div className="overflow-hidden rounded-2xl border border-fo-border bg-fo-surface">
        <div className="relative h-40 sm:h-52 bg-fo-bg">
          {store.coverImage ? (
            <img src={displayImageUrl(store.coverImage, 1200)} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-4 px-4 pb-5 sm:px-6">
          <div className="-mt-10 h-20 w-20 overflow-hidden rounded-2xl border-2 border-fo-surface bg-fo-bg">
            {store.logo ? (
              <img src={displayImageUrl(store.logo, 160)} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
            <p className="mt-1 text-xs text-fo-subtle">
              {categoryLabel(store.category)}
              {place ? ` · ${place}` : ""}
              {` · ${store.followerCount || 0} followers`}
            </p>
          </div>
          <div className="mb-1 flex flex-wrap gap-2">
            {store.isOwner ? (
              <Link
                to={`/stores/manage/${store.id}`}
                className="inline-flex min-h-8 items-center rounded-full border border-fo-border px-3 text-xs font-medium hover:border-fo-accent/40"
              >
                Manage
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={following}
                  className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold disabled:opacity-60 ${
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
                  className="inline-flex min-h-8 items-center rounded-full border border-fo-border px-3 text-xs font-medium"
                >
                  Message
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-fo-border px-3 text-xs font-medium"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
      </div>

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

      {store.description ? (
        <p className="mt-4 text-sm leading-relaxed text-fo-muted whitespace-pre-wrap">{store.description}</p>
      ) : null}

      {store.contactPhone || store.contactEmail ? (
        <p className="mt-2 text-xs text-fo-subtle">
          {store.contactPhone ? <a href={`tel:${store.contactPhone}`} className="hover:text-fo-accent">{store.contactPhone}</a> : null}
          {store.contactPhone && store.contactEmail ? " · " : null}
          {store.contactEmail ? <a href={`mailto:${store.contactEmail}`} className="hover:text-fo-accent">{store.contactEmail}</a> : null}
        </p>
      ) : null}

      {(store.categories || []).length ? (
        <div className="mt-5 flex flex-wrap gap-2">
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

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-fo-subtle">No products in this section yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
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
