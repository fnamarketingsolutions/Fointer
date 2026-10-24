import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuPlus as Plus, LuStore as StoreIcon } from "react-icons/lu";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import ConfirmDeleteModal from "../../../shared/components/modals/ConfirmDeleteModal";
import { displayImageUrl } from "../../../shared/utils/imageUrl";
import { categoryLabel } from "../../marketplace/constants";
import CreateStoreModal from "../components/CreateStoreModal";
import { fetchMyStores, deleteStore } from "../services/storeService";

export default function ManageStores() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyStores();
      setStores(data?.stores || []);
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to load stores.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMyStores();
        if (!cancelled) setStores(data?.stores || []);
      } catch (error) {
        if (!cancelled) {
          showToast(error?.response?.data?.message || "Failed to load stores.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const removeStore = async () => {
    if (!pendingDelete?.id) return;
    setDeleting(true);
    try {
      const result = await deleteStore(pendingDelete.id);
      setStores((rows) => rows.filter((store) => store.id !== pendingDelete.id));
      setPendingDelete(null);
      showToast(result?.message || "Store deleted.");
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to delete store.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[900px] pb-8 text-fo-text">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
            <StoreIcon size={14} aria-hidden /> Stores
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Your storefronts</h1>
          <p className="mt-1 text-sm text-fo-subtle">
            Products you add to a store also appear in the Marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold"
        >
          <Plus size={16} /> Create store
        </button>
      </div>

      {loading ? (
        <PageLoader minHeight="min-h-[30vh]" />
      ) : stores.length === 0 ? (
        <p className="mt-8 rounded-xl border border-fo-border bg-fo-surface px-4 py-8 text-center text-sm text-fo-subtle">
          You do not have a store yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {stores.map((store) => (
            <li key={store.id} className="flex items-center gap-3 rounded-xl border border-fo-border bg-fo-surface p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-fo-bg">
                {store.logo ? (
                  <img src={displayImageUrl(store.logo, 120)} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{store.name}</p>
                <p className="truncate text-[11px] text-fo-subtle">
                  /store/{store.slug} · {categoryLabel(store.category)}
                </p>
                {store.status === "suspended" ? (
                  <p className="text-[11px] text-amber-500">Suspended</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/store/${store.slug}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-fo-border px-3 text-xs text-fo-text hover:border-fo-accent/40"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => navigate(`/stores/manage/${store.id}`)}
                  className="inline-flex min-h-8 items-center rounded-full bg-fo-accent px-3 text-xs font-semibold text-black"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(store)}
                  className="inline-flex min-h-8 items-center rounded-full border border-red-500/40 px-3 text-xs font-medium text-red-500"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateStoreModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(store) => {
          setOpen(false);
          if (store?.id) navigate(`/stores/manage/${store.id}`);
          else load();
        }}
      />
      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title="Delete store"
        variant="dashboard"
        loading={deleting}
        confirmLabel="Delete store"
        onConfirm={removeStore}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      >
        Delete {pendingDelete?.name}? This cannot be undone. Products from this store stay on the marketplace.
      </ConfirmDeleteModal>
    </div>
  );
}
