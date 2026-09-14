import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
} from "react-icons/lu";
import { createListing, fetchListings } from "../../../api/marketplace";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";
import { LISTING_CATEGORIES } from "../constants";

export default function MarketplaceBrowse() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchListings({
        q: search.trim() || undefined,
        category: category || undefined,
        sort,
        page: 1,
        limit: 48,
      });
      setListings(res?.listings || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load marketplace.");
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, showToast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/marketplace" } });
      return;
    }
    setModalOpen(true);
  };

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      const res = await createListing(payload);
      showToast("Listing created.");
      setModalOpen(false);
      const id = res?.listing?.shortCode || res?.listing?.id;
      if (id) navigate(`/marketplace/${id}`);
      else load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
            <ShoppingBag size={14} /> Marketplace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-fo-text">
            Buy and sell with your community
          </h1>
          <p className="mt-2 text-sm text-fo-muted max-w-xl">
            List items for sale and connect with buyers directly. Payment and
            delivery are arranged between you and the other party — Fointer does
            not handle transactions or shipping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate("/marketplace/my-listings")}
              className="px-4 py-2 rounded-lg border border-fo-border text-sm text-fo-text hover:border-fo-accent/40"
            >
              My listings
            </button>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-fo-bg text-sm font-medium"
          >
            <Plus size={16} /> Sell something
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="w-full rounded-lg border border-fo-border bg-fo-bg pl-9 pr-3 py-2.5 text-sm text-fo-text"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-fo-border bg-fo-bg px-3 py-2.5 text-sm text-fo-text"
        >
          <option value="">All categories</option>
          {LISTING_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-fo-border bg-fo-bg px-3 py-2.5 text-sm text-fo-text"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-fo-border text-sm text-fo-muted hover:text-fo-text"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center text-fo-muted text-sm">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-12 text-center text-fo-muted text-sm">
          <p>No listings found.</p>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 text-fo-accent hover:underline"
            >
              Be the first to list something
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {!loading && listings.length > 0 ? (
        <p className="mt-6 text-center text-[11px] text-fo-subtle">
          Showing {listings.length} active listing{listings.length === 1 ? "" : "s"}
          {category ? ` in ${LISTING_CATEGORIES.find((c) => c.value === category)?.label}` : ""}
        </p>
      ) : null}

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
      />
    </div>
  );
}
