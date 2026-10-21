import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuSearch as Search, LuStore as StoreIcon } from "react-icons/lu";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import { categoryLabel, formatLocation } from "../../marketplace/constants";
import { fetchPublicStores } from "../services/storeService";

export default function StoreDirectory() {
  const [stores, setStores] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedQuery, setLoadedQuery] = useState(null);

  useEffect(() => {
    let cancelled = false;
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
          setLoadedQuery(query.trim());
        } catch {
          if (cancelled) return;
          setStores([]);
          setLoadedQuery(query.trim());
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const showLoader = loading || loadedQuery !== query.trim();

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-8 text-fo-text">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
            <StoreIcon size={14} aria-hidden /> Stores
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Storefronts</h1>
        </div>
        <Link
          to="/stores/manage"
          className="inline-flex min-h-9 items-center rounded-full border border-fo-border px-3 text-[13px] font-medium hover:border-fo-accent/40"
        >
          My stores
        </Link>
      </div>
      <div className="relative mt-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search stores"
          className="w-full rounded-xl border border-fo-border bg-fo-surface py-2.5 pl-9 pr-3 text-sm"
        />
      </div>
      {showLoader ? (
        <PageLoader minHeight="min-h-[30vh]" />
      ) : stores.length === 0 ? (
        <p className="mt-8 text-center text-sm text-fo-subtle">No stores found.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                to={`/store/${store.slug}`}
                className="flex items-center gap-3 rounded-xl border border-fo-border bg-fo-surface p-3 hover:border-fo-accent/40"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-fo-bg">
                  {store.logo ? (
                    <img src={displayImageUrl(store.logo, 120)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{store.name}</p>
                  <p className="truncate text-[11px] text-fo-subtle">
                    {categoryLabel(store.category)}
                    {formatLocation(store) ? ` · ${formatLocation(store)}` : ""}
                  </p>
                  <p className="text-[11px] text-fo-muted">
                    {store.followerCount || 0} followers
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
