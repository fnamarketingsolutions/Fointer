import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LuArrowRight as ArrowRight,
  LuFilter as Filter,
  LuHash as Hash,
  LuLoaderCircle as Loader2,
  LuLogIn as LogIn,
  LuUserPlus as UserPlus,
  LuUsers as Users,
} from "react-icons/lu";
import SiteLinksFooter from "../../../../shared/components/SiteLinksFooter";
import { communitySegment } from "../../../../shared/services/entityLinks";
import { formatCount } from "../../../../shared/utils/format";
import { EXPLORE_PATH, FEED_PATH } from "../../../../shared/constants/paths";

const SIDE_CARD =
  "bg-fo-surface border border-fo-border rounded-xl p-3 space-y-2";

const CATEGORY_PREVIEW = 12;

export function CategoryList({
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? channels
    : channels.slice(0, CATEGORY_PREVIEW);
  const hasMore = channels.length > CATEGORY_PREVIEW;

  return (
    <div className={SIDE_CARD}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
          <Hash size={15} className="text-fo-accent" aria-hidden />
          Categories
        </div>
        {selectedChannel ? (
          <button
            type="button"
            onClick={() => onSelectChannel("")}
            className="text-xs text-fo-subtle hover:text-fo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
          >
            Clear
          </button>
        ) : null}
      </div>
      {channelsLoading ? (
        <div className="flex items-center gap-2 text-xs text-fo-subtle py-1">
          <Loader2 size={12} className="animate-spin text-fo-accent" />
          Loading...
        </div>
      ) : channels.length === 0 ? (
        <p className="text-xs text-fo-subtle">No categories yet.</p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {visible.map((ch) => {
              const name = ch.name || "";
              const active =
                selectedChannel.toLowerCase() === name.toLowerCase();
              return (
                <li key={ch.id || name}>
                  <button
                    type="button"
                    onClick={() => onSelectChannel(active ? "" : name)}
                    aria-pressed={active}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                      active
                        ? "bg-fo-accent/15 text-fo-accent"
                        : "text-fo-muted hover:text-fo-accent hover:bg-fo-surface-hover"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-fo-accent/10 border border-fo-accent/25 flex items-center justify-center text-[10px] text-fo-accent font-bold shrink-0">
                      {(name || "?")[0].toUpperCase()}
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-fo-accent hover:text-fo-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
            >
              {expanded
                ? "Show less"
                : `Show more (${channels.length - CATEGORY_PREVIEW})`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function CommunityThumb({ community }) {
  const name = community?.name || "Community";
  if (community?.coverImage) {
    return (
      <img
        src={community.coverImage}
        alt=""
        className="w-8 h-8 rounded-lg object-cover border border-fo-border shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-fo-surface-3 border border-fo-border flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-fo-accent/70">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function OtherCommunitiesCard({
  communities = [],
  loading = false,
}) {
  return (
    <div className={SIDE_CARD}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
          <Users size={15} className="text-fo-accent" aria-hidden />
          Other communities
        </div>
        <Link
          to="/communities"
          className="text-xs text-fo-subtle hover:text-fo-accent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
        >
          See all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-fo-subtle py-1">
          <Loader2 size={12} className="animate-spin text-fo-accent" />
          Loading...
        </div>
      ) : communities.length === 0 ? (
        <p className="text-xs text-fo-subtle">No other communities yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {communities.map((community) => {
            const segment = communitySegment(community) || community.id;
            return (
              <li key={community.id || segment}>
                <Link
                  to={`/communities/${segment}`}
                  className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs text-fo-muted hover:text-fo-accent hover:bg-fo-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <CommunityThumb community={community} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fo-text">
                      {community.name || "Community"}
                    </span>
                    {typeof community.memberCount === "number" ? (
                      <span className="block text-xs text-fo-subtle">
                        {formatCount(community.memberCount)} members
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight
                    size={12}
                    className="shrink-0 text-fo-subtle"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FeedFilterToggle({ open, active, onClick, controlsId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lg:hidden relative min-h-10 min-w-10 inline-flex items-center justify-center p-2 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
        open || active
          ? "border-fo-accent/45 text-fo-accent bg-fo-accent/10"
          : "border-fo-border text-fo-muted hover:text-fo-accent"
      }`}
      title="Filters"
      aria-label={open ? "Close filters" : "Open filters"}
      aria-expanded={open}
      aria-controls={controlsId || undefined}
    >
      <Filter size={16} aria-hidden />
      {active ? (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-fo-accent" />
      ) : null}
    </button>
  );
}

export function FeedFooterRail({ isGuest }) {
  const location = useLocation();
  const loginFrom =
    location.pathname === EXPLORE_PATH || location.pathname === FEED_PATH
      ? `${location.pathname}${location.search}`
      : isGuest
        ? EXPLORE_PATH
        : FEED_PATH;

  return (
    <div className="space-y-3">
      {isGuest ? (
        <div className={SIDE_CARD}>
          <h2 className="text-sm font-semibold text-fo-text leading-snug">
            Join the conversation on Fointer
          </h2>
          <p className="text-xs text-fo-subtle leading-relaxed">
            Log in to like, comment, join communities, and create live events or
            watch groups.
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 min-h-10 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            <UserPlus size={14} aria-hidden /> Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: loginFrom }}
            className="w-full inline-flex items-center justify-center gap-2 min-h-10 px-3 py-2 rounded-lg border border-fo-border text-fo-text text-xs font-semibold hover:border-fo-accent/40 hover:text-fo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            <LogIn size={14} aria-hidden /> Log in
          </Link>
        </div>
      ) : null}

      <SiteLinksFooter className="pt-0.5" />
    </div>
  );
}

export function FeedDesktopRail(props) {
  return (
    <aside className="space-y-3" aria-label="Feed sidebar">
      <CategoryList {...props} />
      <OtherCommunitiesCard
        communities={props.communities}
        loading={props.communitiesLoading}
      />
      <FeedFooterRail isGuest={props.isGuest} />
    </aside>
  );
}
