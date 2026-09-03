import React from "react";
import { useNavigate } from "react-router-dom";
import { LuMapPin as MapPin } from "react-icons/lu";
import {
  categoryLabel,
  formatLocation,
  formatPrice,
} from "../constants";

export default function ListingCard({ listing, onClick }) {
  const navigate = useNavigate();
  const cover = listing.media?.[0];
  const location = formatLocation(listing);

  const handleClick = () => {
    if (onClick) {
      onClick(listing);
      return;
    }
    const id = listing.shortCode || listing.id;
    navigate(`/marketplace/${id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group text-left rounded-xl border border-fo-border bg-fo-surface overflow-hidden hover:border-fo-accent/40 transition-colors w-full"
    >
      <div className="aspect-[4/3] bg-fo-bg relative overflow-hidden">
        {cover ? (
          cover.type === "video" ? (
            <video
              src={cover.url}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            />
          ) : (
            <img
              src={cover.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fo-subtle text-xs">
            No image
          </div>
        )}
        {listing.status === "sold" && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wide">
            Sold
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-base font-semibold text-fo-text">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <p className="mt-1 text-sm text-fo-text line-clamp-2 leading-snug">
          {listing.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fo-muted">
          {location ? (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          ) : null}
          {listing.category ? (
            <span className="text-fo-subtle">
              {location ? "· " : ""}
              {categoryLabel(listing.category)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
