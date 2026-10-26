import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuFilter as Filter,
  LuPlus as Plus,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
} from "react-icons/lu";
import {
  createFreeListing,
  createListing,
  fetchFreeListings,
  fetchListings,
} from "../../../api/marketplace";
import { toggleBookmark } from "../../../api/bookmarks";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ListingCard from "../components/ListingCard";
import ListingFormModal from "../components/ListingFormModal";
import MarketplaceRail from "../components/MarketplaceRail";
import { LISTING_CATEGORIES } from "../constants";
import {
  freeListingSegment,
  listingSegment,
} from "../../../shared/services/entityLinks";
import { PageLoader } from "../../../shared/components/ThemeSpinner";
import ThirdPartyAdSlot from "../../subscription/components/ThirdPartyAdSlot";
import SplitScrollLayout from "../../../shared/layouts/SplitScrollLayout";

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

export default function MarketplaceBrowse({ isFreeListing = false }) {
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

  useEffect(() => {
    if (!searchParams.get("communityId")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("communityId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", value);
    else next.delete("category");
    // Drop legacy community placement query if present.
    next.delete("communityId");
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetchItems = isFreeListing ? fetchFreeListings : fetchListings;
      const res = await fetchItems({
        q: search.trim() || undefined,
        category: category || undefined,
        sort,
        page: 1,
        limit: 48,
      });
      setListings(res?.listings || []);
    } catch (err) {
      showToast(
        err?.response?.data?.message ||
          `Failed to load ${isFreeListing ? "free listings" : "marketplace"}.`
      );
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, showToast, isFreeListing]);

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
      navigate("/login", {
        state: { from: isFreeListing ? "/free-listings" : "/marketplace" },
      });
      return;
    }
    setModalOpen(true);
  };

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      const res = isFreeListing
        ? await createFreeListing(payload)
        : await createListing(payload);
      showToast(isFreeListing ? "Free listing created." : "Listing created.");
      setModalOpen(false);
      const segment = isFreeListing
        ? freeListingSegment(res?.listing)
        : listingSegment(res?.listing);
      if (segment) navigate(`${isFreeListing ? "/free-listings" : "/marketplace"}/${segment}`);
      else load();
    } catch (err) {
      showToast(
        err?.response?.data?.message ||
          `Failed to create ${isFreeListing ? "free listing" : "listing"}.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveListing = async (listing) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: isFreeListing ? "/free-listings" : "/marketplace" },
      });
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
  const topSponsored = isFreeListing
    ? []
    : listings.filter((listing) => listing.sponsorship?.top);
  const sectionSponsored = isFreeListing ? [] : listings.filter(
    (listing) =>
      listing.isSponsored &&
      !listing.sponsorship?.top &&
      (listing.sponsorship?.section || listing.sponsorship?.badge)
  );
  const featuredIds = new Set(
    [...topSponsored, ...sectionSponsored].map((listing) => listing.id)
  );
  const organicListings = listings.filter(
    (listing) => !featuredIds.has(listing.id)
  );

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <SplitScrollLayout
        sidebar={
          <MarketplaceRail
            selectedCategory={category}
            onSelectCategory={setCategory}
            isGuest={!isAuthenticated}
          />
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
                <ShoppingBag size={14} aria-hidden /> {isFreeListing ? "Free Listings" : "Marketplace"}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-fo-text leading-tight">
                {isFreeListing ? "Give away items in your community" : "Buy and sell with your community"}
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug max-w-xl">
                {isFreeListing
                  ? "Find items offered for free or share something you no longer need."
                  : "List items and connect with buyers directly. Promotion fees are processed separately; Fointer does not process item-sale payments."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 xl:max-w-lg xl:justify-end">
              {isAuthenticated ? (
                <>
                  {!isFreeListing ? <button
                    type="button"
                    onClick={() => navigate("/stores")}
                    className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors"
                  >
                    Stores
                  </button> : null}
                  {!isFreeListing ? <button
                    type="button"
                    onClick={() => navigate("/stores/manage")}
                    className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors"
                  >
                    My stores
                  </button> : null}
                  <button
                    type="button"
                    onClick={() => navigate(isFreeListing ? "/free-listings/mine" : "/marketplace/my-listings")}
                    className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors"
                  >
                    {isFreeListing ? "My free listings" : "My listings"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover transition-colors"
              >
                <Plus size={16} aria-hidden /> {isFreeListing ? "Give away" : "Sell"}
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
                  {(isFreeListing
                    ? SORT_OPTIONS.filter((option) =>
                        ["newest", "oldest"].includes(option.id)
                      )
                    : SORT_OPTIONS
                  ).map((opt) => {
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
          <div className="lg:hidden min-w-0" role="group" aria-label="Categories">
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain fointer-scrollbar [-webkit-overflow-scrolling:touch]">
              <button
                type="button"
                onClick={() => setCategory("")}
                aria-pressed={!category}
                className={`shrink-0 inline-flex items-center min-h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
                  category
                    ? "border border-fo-border text-fo-text"
                    : "bg-fo-accent text-black"
                }`}
              >
                All
              </button>
              {LISTING_CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(active ? "" : item.value)}
                    aria-pressed={active}
                    className={`shrink-0 inline-flex items-center min-h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-fo-accent text-black"
                        : "border border-fo-border text-fo-text"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          {category ? (
            <button
              type="button"
              onClick={() => setCategory("")}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-fo-accent/15 text-fo-accent hover:bg-fo-accent/25"
            >
              {categoryName}
              <span aria-hidden>×</span>
            </button>
          ) : null}

          {loading ? (
            <PageLoader minHeight="py-16" size="md" />
          ) : listings.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
              <p>{isFreeListing ? "No free listings found." : "No listings found."}</p>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                >
                  {isFreeListing ? "Be the first to offer something for free" : "Be the first to list something"}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {topSponsored.length ? (
                <section aria-label="Top sponsored listings" className="space-y-2 min-w-0">
                  <h2 className="text-sm font-semibold text-fo-text">Featured listings</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {topSponsored.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onSave={handleSaveListing} freeListing={isFreeListing} />
                    ))}
                  </div>
                </section>
              ) : null}
              {sectionSponsored.length ? (
                <section aria-label="Sponsored listings" className="space-y-2 min-w-0">
                  <h2 className="text-sm font-semibold text-fo-text">Sponsored</h2>
                  <div className="flex gap-3 w-full min-w-0 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-1 fointer-scrollbar [-webkit-overflow-scrolling:touch]">
                    {sectionSponsored.map((listing) => (
                      <div
                        key={listing.id}
                        className="w-[calc((100%-0.75rem)/2)] md:w-[calc((100%-1.5rem)/3)] shrink-0 snap-start"
                      >
                        <ListingCard listing={listing} onSave={handleSaveListing} freeListing={isFreeListing} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {!isFreeListing ? <ThirdPartyAdSlot placement="marketplace_browse" /> : null}
              {organicListings.length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {organicListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onSave={handleSaveListing} freeListing={isFreeListing} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SplitScrollLayout>

      <div className="lg:hidden mt-4">
        <MarketplaceRail
          selectedCategory={category}
          onSelectCategory={setCategory}
          isGuest={!isAuthenticated}
          showCategories={false}
        />
      </div>

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        isFree={isFreeListing}
        title={isFreeListing ? "Create free listing" : "Create listing"}
      />
    </div>
  );
}
