import { Link, useLocation } from "react-router-dom";
import { LuLayoutGrid as LayoutGrid, LuShield as Shield } from "react-icons/lu";
import { FeedFooterRail } from "../../communities/pages/dashboard/FeedRail";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { LISTING_CATEGORIES } from "../constants";

const SIDE_CARD =
  "bg-fo-surface border border-fo-border rounded-xl p-3 space-y-2 shadow-[0_1px_2px_rgba(26,22,18,0.04)]";

export default function MarketplaceRail({
  selectedCategory = "",
  onSelectCategory,
  isGuest = false,
  seller = null,
}) {
  const location = useLocation();

  return (
    <aside className="space-y-3" aria-label="Marketplace sidebar">
      {seller ? (
        <div className={SIDE_CARD}>
          <h2 className="text-[13px] font-semibold text-fo-text">Seller</h2>
          <div className="flex items-center gap-2 min-w-0">
            <ProfileAvatar
              src={seller.avatar}
              name={seller.name}
              className="w-8 h-8 rounded-full object-cover border border-fo-border shrink-0"
            />
            <UserProfileLink
              author={seller}
              className="text-[13px] font-medium text-fo-text hover:text-fo-accent truncate"
            >
              {seller.name || seller.username || "Member"}
            </UserProfileLink>
          </div>
        </div>
      ) : null}

      <div className={SIDE_CARD}>
        <div className="flex items-center gap-1.5">
          <LayoutGrid size={15} className="text-fo-accent shrink-0" aria-hidden />
          <h2 className="text-[13px] font-semibold text-fo-text">Categories</h2>
        </div>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onSelectCategory("")}
              aria-pressed={!selectedCategory}
              className={`w-full text-left px-2 py-1.5 rounded-xl text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                !selectedCategory
                  ? "bg-fo-accent/12 text-fo-accent"
                  : "text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
              }`}
            >
              All listings
            </button>
          </li>
          {LISTING_CATEGORIES.map((item) => {
            const active = selectedCategory === item.value;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(active ? "" : item.value)}
                  aria-pressed={active}
                  className={`w-full text-left px-2 py-1.5 rounded-xl text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                    active
                      ? "bg-fo-accent/12 text-fo-accent"
                      : "text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={SIDE_CARD}>
        <div className="flex items-center gap-1.5">
          <Shield size={15} className="text-fo-accent shrink-0" aria-hidden />
          <h2 className="text-[13px] font-semibold text-fo-text">Safety</h2>
        </div>
        <p className="text-xs text-fo-subtle leading-relaxed">
          Fointer does not process payments, escrow, or shipping. Meet in a
          public place and arrange delivery directly with the other person.
        </p>
        {location.pathname !== "/marketplace" ? (
          <Link
            to="/marketplace"
            className="inline-flex text-xs font-medium text-fo-accent hover:text-fo-accent-hover"
          >
            Browse marketplace
          </Link>
        ) : null}
      </div>

      <FeedFooterRail isGuest={isGuest} />
    </aside>
  );
}
