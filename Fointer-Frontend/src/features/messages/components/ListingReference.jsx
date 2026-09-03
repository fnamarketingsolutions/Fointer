import { formatPrice } from '../../marketplace/constants';

export default function ListingReference({ listing, onClick }) {
  if (!listing) return null;

  const path = listing.shortCode || listing.listingId;
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-fo-border bg-fo-bg/80 max-w-sm">
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt=""
          className="w-14 h-14 rounded-lg object-cover border border-fo-border shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-fo-surface border border-fo-border shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-fo-subtle">
          Marketplace listing
        </p>
        <p className="text-sm font-medium text-fo-text truncate">
          {listing.title || 'Listing'}
        </p>
        <p className="text-xs text-fo-accent font-semibold">
          {formatPrice(listing.price, listing.currency)}
        </p>
      </div>
    </div>
  );

  if (onClick || path) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left hover:opacity-90 transition-opacity"
      >
        {content}
      </button>
    );
  }

  return content;
}
