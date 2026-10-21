import { useEffect, useState } from "react";
import {
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuStore as StoreIcon,
} from "react-icons/lu";
import {
  fetchAdminStores,
  restoreAdminStore,
  suspendAdminStore,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
];

const ownerLabel = (owner) => owner?.name || owner?.username || "Unknown";

export default function StoreManagement() {
  const { showToast } = useToast();
  const [stores, setStores] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadedStoreKey, setLoadedStoreKey] = useState("");
  const [storeReload, setStoreReload] = useState(0);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      (async () => {
        try {
          const data = await fetchAdminStores({
            q: query.trim() || undefined,
            status: status || undefined,
            page: 1,
            limit: 50,
          });
          if (cancelled) return;
          setStores(data?.stores || []);
          setLoadedStoreKey(`${status}:${query.trim()}`);
        } catch (error) {
          if (cancelled) return;
          setStores([]);
          setLoadedStoreKey(`${status}:${query.trim()}`);
          showToast(getErrorMessage(error, "Failed to load stores."));
        } finally {
          if (!cancelled) setLoadingStores(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, status, showToast, storeReload]);

  const refresh = () => {
    setLoadedStoreKey("");
    setStoreReload((value) => value + 1);
  };

  const changeStatus = async (store) => {
    const suspend = store.status !== "suspended";
    if (suspend && !window.confirm(`Suspend ${store.name}? Shoppers will no longer see it.`)) {
      return;
    }
    setBusyId(store.id);
    try {
      const result = suspend
        ? await suspendAdminStore(store.id)
        : await restoreAdminStore(store.id);
      const next = result?.store;
      setStores((rows) =>
        rows.map((row) =>
          row.id === store.id
            ? {
                ...row,
                status: next?.status || (suspend ? "suspended" : "active"),
              }
            : row
        )
      );
      showToast(result?.message || (suspend ? "Store suspended." : "Store restored."));
    } catch (error) {
      showToast(getErrorMessage(error, "Could not update this store."));
    } finally {
      setBusyId("");
    }
  };

  const storeKey = `${status}:${query.trim()}`;
  const storesBusy = loadingStores || loadedStoreKey !== storeKey;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 text-fo-text">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <StoreIcon size={20} className="text-fo-accent" />
            Stores
          </h1>
          <p className="text-sm text-fo-subtle mt-1">
            View each storefront, its owner, and suspend or restore it. Stores are free in this release.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={storesBusy ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or link"
            className="w-full rounded-lg border border-fo-border bg-fo-bg py-2 pl-8 pr-3 text-sm"
          />
        </div>
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.id || "all"}
            type="button"
            onClick={() => setStatus(item.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              status === item.id
                ? "bg-fo-accent text-black"
                : "border border-fo-border text-fo-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {storesBusy ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-fo-subtle">
          <Loader2 className="animate-spin" size={16} /> Loading stores
        </div>
      ) : stores.length === 0 ? (
        <p className="py-12 text-center text-sm text-fo-subtle">No stores found.</p>
      ) : (
        <ul className="divide-y divide-fo-border overflow-hidden rounded-xl border border-fo-border bg-fo-surface">
          {stores.map((store) => (
            <li key={store.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{store.name}</p>
                <p className="truncate text-xs text-fo-subtle">
                  /store/{store.slug} · {ownerLabel(store.owner)}
                </p>
              </div>
              <span className="text-xs text-fo-muted">
                {store.activeProductCount || 0} active
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  store.status === "suspended"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {store.status}
              </span>
              <button
                type="button"
                disabled={busyId === store.id}
                onClick={() => changeStatus(store)}
                className="rounded-full border border-fo-border px-3 py-1 text-xs font-medium disabled:opacity-60"
              >
                {busyId === store.id
                  ? "…"
                  : store.status === "suspended"
                    ? "Restore"
                    : "Suspend"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
