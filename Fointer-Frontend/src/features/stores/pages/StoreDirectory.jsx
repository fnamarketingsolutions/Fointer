import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuMapPin as MapPin,
  LuSearch as Search,
  LuStore as StoreIcon,
  LuUsers as Users,
} from "react-icons/lu";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import { categoryLabel, formatLocation } from "../../marketplace/constants";
import { fetchPublicStores } from "../services/storeService";

export default function StoreDirectory() {
  const [stores, setStores] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const requestKey = `${query.trim()}:${retry}`;
    const handle = setTimeout(() => {
      (async () => {
        try {
          const data = await fetchPublicStores({
            q: query.trim(),
            page: 1,
            limit: 24,
          });
          if (cancelled) return;
          setStores(data?.stores || []);
          setLoadError("");
        } catch (error) {
          if (cancelled) return;
          setStores([]);
          setLoadError(
            error?.response?.data?.message || "Could not load stores."
          );
        } finally {
          if (!cancelled) {
            setLoadedRequest(requestKey);
            setLoading(false);
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, retry]);

  const requestKey = `${query.trim()}:${retry}`;
  const showLoader = loading || loadedRequest !== requestKey;

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-8 text-fo-text">
      <Link
        to="/marketplace"
        className="mb-4 inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-sm text-fo-muted transition-colors hover:text-fo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
      >
        <ArrowLeft size={16} /> Back to marketplace
      </Link>
      <section className="rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fo-accent/10 text-fo-accent">
              <StoreIcon size={20} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-fo-accent">Discover</p>
              <h1 className="text-xl font-semibold tracking-tight">
                Storefronts
              </h1>
              <p className="mt-0.5 text-xs text-fo-subtle">
                Browse stores and find what you need.
              </p>
            </div>
          </div>
          <Link
            to="/stores/manage"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-fo-border px-4 text-[13px] font-medium transition-colors hover:border-fo-accent/40 hover:text-fo-accent"
          >
            My stores
          </Link>
        </div>
        <label className="relative mt-5 block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle"
            aria-hidden
          />
          <span className="sr-only">Search stores</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stores by name"
            className="w-full rounded-xl border border-fo-border bg-fo-bg py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-fo-subtle focus:border-fo-accent/50 focus:ring-2 focus:ring-fo-accent/10"
          />
        </label>
      </section>

      <div className="mt-6">
        {!showLoader && !loadError && stores.length > 0 ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Browse stores</h2>
            <span className="text-xs text-fo-subtle">
              {stores.length} {stores.length === 1 ? "store" : "stores"}
            </span>
          </div>
        ) : null}
        {showLoader ? (
        <PageLoader minHeight="min-h-[30vh]" />
        ) : loadError ? (
          <div className="rounded-2xl border border-dashed border-fo-border bg-fo-surface px-4 py-10 text-center">
            <p className="text-sm font-medium">{loadError}</p>
            <button
              type="button"
              onClick={() => setRetry((current) => current + 1)}
              className="mt-3 inline-flex min-h-9 items-center rounded-full border border-fo-border px-4 text-xs font-medium transition-colors hover:border-fo-accent/40 hover:text-fo-accent"
            >
              Try again
            </button>
          </div>
        ) : stores.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-fo-border bg-fo-surface px-4 py-10 text-center">
            <StoreIcon size={22} className="mx-auto text-fo-subtle" aria-hidden />
            <p className="mt-2 text-sm font-medium">No stores found</p>
            <p className="mt-1 text-xs text-fo-subtle">
              Try another search term.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stores.map((store) => {
              const location = formatLocation(store);
              return (
                <li key={store.id}>
                  <Link
                    to={`/store/${store.slug}`}
                    className="group flex min-h-28 items-center gap-4 rounded-2xl border border-fo-border bg-fo-surface p-4 transition-all hover:-translate-y-0.5 hover:border-fo-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-fo-border bg-fo-bg">
                      {store.logo ? (
                        <img
                          src={displayImageUrl(store.logo, 120)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <StoreIcon
                          size={24}
                          className="text-fo-subtle"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold transition-colors group-hover:text-fo-accent">
                        {store.name}
                      </p>
                      <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-fo-accent/10 px-2 py-0.5 text-[10px] font-medium text-fo-accent">
                        {categoryLabel(store.category)}
                      </span>
                      {location ? (
                        <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-fo-subtle">
                          <MapPin size={12} className="shrink-0" aria-hidden />
                          <span className="truncate">{location}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-fo-muted">
                        <Users size={12} aria-hidden />
                        {store.followerCount || 0} followers
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
