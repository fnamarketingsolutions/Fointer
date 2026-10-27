import { LuMapPin as MapPin, LuStore as StoreIcon } from "react-icons/lu";
import { Link } from "react-router-dom";
import { categoryLabel, formatLocation } from "../../marketplace/constants";
import { displayImageUrl } from "../../../shared/utils/imageUrl";

export default function StoreReference({ store }) {
  if (!store?.slug) return null;

  const location = formatLocation(store);

  return (
    <Link
      to={`/store/${store.slug}`}
      className="flex max-w-sm items-center gap-3 rounded-xl border border-fo-border bg-fo-bg/80 p-3 transition-colors hover:border-fo-accent/40"
    >
      {store.logo ? (
        <img
          src={displayImageUrl(store.logo, 120)}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg border border-fo-border object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-fo-border bg-fo-surface text-fo-subtle">
          <StoreIcon size={20} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wider text-fo-subtle">
          Store
        </span>
        <span className="block truncate text-sm font-medium text-fo-text">
          {store.name || "Store"}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fo-muted">
          <span className="truncate">{categoryLabel(store.category)}</span>
          {location ? (
            <>
              <MapPin size={11} className="shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
