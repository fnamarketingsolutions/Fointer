import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuFilter as Filter,
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
} from "react-icons/lu";
import { createListing, fetchListings } from "../../../api/marketplace";
import { toggleBookmark } from "../../../api/bookmarks";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";
import MarketplaceRail from "../components/MarketplaceRail";
import { LISTING_CATEGORIES } from "../constants";
import { listingSegment } from "../../../shared/services/entityLinks";
import {
  fetchBrowsableCommunities,
  fetchJoinedCommunities,
} from "../../communities/services/communityService";

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

export default function MarketplaceBrowse() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const category = searchParams.get("category") || "";
  const communityId = searchParams.get("communityId") || "";

  const [communities, setCommunities] = useState([]);
  const [communityLoadError, setCommunityLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchBrowsableCommunities({ limit: 100, includeJoined: true }),
      fetchJoinedCommunities(),
    ])
      .then(([browseResult, joinedResult]) => {
        if (!active) return;
        const merged = new Map();
        for (const community of [
          ...(browseResult?.communities || []),
          ...(joinedResult?.communities || []),
        ]) {
          merged.set(String(community.id), community);
        }
        setCommunities([...merged.values()]);
        setCommunityLoadError("");
      })
      .catch((error) => {
        const message = error?.response?.data?.message || "Failed to load communities.";
        setCommunityLoadError(message);
        showToast(message);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const setCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", value);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  const setCommunity = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("communityId", value);
    else next.delete("communityId");
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchListings({
        q: search.trim() || undefined,
        category: category || undefined,
        communityId: communityId || undefined,
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
  }, [search, category, communityId, sort, showToast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const onPointerDown = (event) => {
      if (!filterRef.current?.contains(event.target)) setFilterOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filterOpen]);

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
      const segment = listingSegment(res?.listing);
      if (segment) navigate(`/marketplace/${segment}`);
      else load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveListing = async (listing) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/marketplace" } });
      return;
    }
    const prev = listings;
    setListings((list) =>
      list.map((item) =>
        item.id === listing.id
          ? { ...item, savedByMe: !item.savedByMe }
          : item
      )
    );
    try {
      const data = await toggleBookmark({
        targetType: "listing",
        targetId: listing.id,
      });
      setListings((list) =>
        list.map((item) =>
          item.id === listing.id
            ? { ...item, savedByMe: Boolean(data?.saved) }
            : item
        )
      );
      showToast(
        data?.message || (data?.saved ? "Saved." : "Removed from saved.")
      );
    } catch (err) {
      setListings(prev);
      showToast(err?.response?.data?.message || "Failed to update bookmark.");
    }
  };

  const categoryName = LISTING_CATEGORIES.find((c) => c.value === category)?.label;
  const topSponsored = listings.filter((listing) => listing.sponsorship?.top);
  const sectionSponsored = listings.filter(
    (listing) => listing.sponsorship?.section && !listing.sponsorship?.top
  );
  const featuredIds = new Set(
    [...topSponsored, ...sectionSponsored].map((listing) => listing.id)
  );
  const organicListings = listings.filter(
    (listing) => !featuredIds.has(listing.id)
  );

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
                <ShoppingBag size={14} aria-hidden /> Marketplace
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-fo-text leading-tight">
                Buy and sell with your community
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug max-w-xl">
                List items and connect with buyers directly. Promotion fees are
                processed separately; Fointer does not process item-sale payments.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate("/marketplace/my-listings")}
                  className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors"
                >
                  My listings
                </button>
              ) : null}
              {communities.length ? (
                <label className="inline-flex items-center gap-2 text-xs text-fo-subtle">
                  Community placement
                  <select
                    value={communityId}
                    onChange={(event) => setCommunity(event.target.value)}
                    className="max-w-[220px] rounded-lg border border-fo-border bg-fo-surface px-2.5 py-1.5 text-xs text-fo-text"
                  >
                    <option value="">All marketplace listings</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>{community.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover transition-colors"
              >
                <Plus size={16} aria-hidden /> Sell
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search listings..."
                className="w-full rounded-xl border border-fo-border bg-fo-surface pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
              />
            </div>
            <div ref={filterRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen((open) => !open)}
                aria-expanded={filterOpen}
                className={`inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                  filterOpen || sort !== "newest"
                    ? "border-fo-accent/45 text-fo-accent bg-fo-accent/10"
                    : "border-fo-border text-fo-muted hover:text-fo-text"
                }`}
              >
                <Filter size={16} aria-hidden />
                Filter
              </button>
              {filterOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-fo-border bg-fo-surface p-2 shadow-[0_8px_24px_rgba(26,22,18,0.08)]">
                  <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-fo-subtle">
                    Sort by
                  </p>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sort === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSort(opt.id);
                          setFilterOpen(false);
                        }}
                        className={`w-full text-left px-2 py-2 rounded-lg text-[13px] ${
                          active
                            ? "bg-fo-accent/12 text-fo-accent font-medium"
                            : "text-fo-muted hover:bg-fo-surface-hover hover:text-fo-text"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          {category ? (
            <button
              type="button"
              onClick={() => setCategory("")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-fo-accent/15 text-fo-accent hover:bg-fo-accent/25"
            >
              {categoryName}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {communityLoadError ? (
            <p role="alert" className="text-xs text-red-400">
              {communityLoadError} Community-targeted placements may not be visible.
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16 text-fo-muted">
              <Loader2 size={20} className="animate-spin text-fo-accent" />
            </div>
          ) : listings.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
              <p>No listings found.</p>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                >
                  Be the first to list something
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {topSponsored.length ? (
                <section aria-label="Top sponsored listings" className="space-y-2">
                  <h2 className="text-sm font-semibold text-fo-text">Featured listings</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {topSponsored.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onSave={handleSaveListing} />
                    ))}
                  </div>
                </section>
              ) : null}
              {sectionSponsored.length ? (
                <section aria-label="Sponsored listings" className="space-y-2">
                  <h2 className="text-sm font-semibold text-fo-text">Sponsored</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sectionSponsored.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onSave={handleSaveListing} />
                    ))}
                  </div>
                </section>
              ) : null}
              {organicListings.length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {organicListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onSave={handleSaveListing} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <MarketplaceRail
            selectedCategory={category}
            onSelectCategory={setCategory}
            isGuest={!isAuthenticated}
          />
        </div>
      </div>

      <div className="lg:hidden mt-4">
        <MarketplaceRail
          selectedCategory={category}
          onSelectCategory={setCategory}
          isGuest={!isAuthenticated}
        />
      </div>

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
      />
    </div>
  );
}
