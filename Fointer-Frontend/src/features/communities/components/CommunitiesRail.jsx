import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LuFolders as Folders, LuUsers as Users, LuX as X } from "react-icons/lu";
import { APP_SCROLL_ID } from "../../../shared/utils/scroll";
import {
  CategoryList,
  FeedFooterRail,
} from "../pages/dashboard/FeedRail";

const SIDE_CARD =
  "bg-fo-surface border border-fo-border rounded-xl p-3 space-y-2 shadow-[0_1px_2px_rgba(26,22,18,0.04)]";

export function CommunitiesCategoryFilters({
  open,
  onClose,
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const scroller = document.getElementById(APP_SCROLL_ID);
    const prevBody = document.body.style.overflow;
    const prevScroller = scroller?.style.overflow;
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      if (scroller) scroller.style.overflow = prevScroller || "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close filters"
      />
      <div
        id="communities-filters-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="communities-filters-title"
        className="relative w-full max-h-[85vh] rounded-t-2xl bg-fo-bg border-t border-fo-border shadow-[0_-12px_40px_rgba(26,22,18,0.18)] flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-fo-border" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-fo-border">
          <h2
            id="communities-filters-title"
            className="text-[15px] font-semibold text-fo-text"
          >
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto fointer-scrollbar p-3">
          <CategoryList
            channels={channels}
            channelsLoading={channelsLoading}
            selectedChannel={selectedChannel}
            onSelectChannel={onSelectChannel}
            viewAllTo={null}
          />
        </div>
        <div className="p-3 border-t border-fo-border bg-fo-bg">
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center min-h-10 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommunitiesRail({
  items = [],
  selectedId = "",
  onSelect,
  isGuest = false,
  managePage = false,
  showCategories = false,
  channels = [],
  channelsLoading = false,
  selectedCategory = "",
  onSelectCategory,
}) {
  return (
    <aside className="space-y-3" aria-label="Communities sidebar">
      {items.length > 0 ? (
        <div className={SIDE_CARD}>
          <div className="flex items-center gap-1.5">
            <Users size={15} className="text-fo-accent shrink-0" aria-hidden />
            <h2 className="text-[13px] font-semibold text-fo-text">
              {managePage ? "Role" : "Browse"}
            </h2>
          </div>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(item.id)}
                    aria-pressed={active}
                    className={`w-full text-left px-2 py-1.5 rounded-xl text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                      active
                        ? "bg-fo-accent/12 text-fo-accent"
                        : "text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
                    }`}
                  >
                    {item.label}
                    {item.count > 0 ? (
                      <span className="ml-1.5 text-[11px] opacity-70">
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showCategories ? (
        <CategoryList
          channels={channels}
          channelsLoading={channelsLoading}
          selectedChannel={selectedCategory}
          onSelectChannel={onSelectCategory}
          viewAllTo={null}
        />
      ) : null}

      <div className={SIDE_CARD}>
        <div className="flex items-center gap-1.5">
          <Folders size={15} className="text-fo-accent shrink-0" aria-hidden />
          <h2 className="text-[13px] font-semibold text-fo-text">
            {managePage ? "Browse" : "Manage"}
          </h2>
        </div>
        <p className="text-xs text-fo-subtle leading-relaxed">
          {managePage
            ? "Jump back to public communities, invites, and requests."
            : "Create a community or manage members, requests, and settings."}
        </p>
        {managePage ? (
          <Link
            to="/communities"
            className="inline-flex text-xs font-medium text-fo-accent hover:text-fo-accent-hover"
          >
            Browse communities
          </Link>
        ) : isGuest ? (
          <Link
            to="/login"
            state={{ from: "/communities/manage" }}
            className="inline-flex text-xs font-medium text-fo-accent hover:text-fo-accent-hover"
          >
            Log in to manage
          </Link>
        ) : (
          <Link
            to="/communities/manage"
            className="inline-flex text-xs font-medium text-fo-accent hover:text-fo-accent-hover"
          >
            Manage communities
          </Link>
        )}
      </div>

      <FeedFooterRail isGuest={isGuest} />
    </aside>
  );
}
