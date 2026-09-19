import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LuArrowRight as ArrowRight,
  LuChevronDown as ChevronDown,
  LuFilter as Filter,
  LuLoaderCircle as Loader2,
  LuLogIn as LogIn,
  LuUserPlus as UserPlus,
  LuX as X,
} from "react-icons/lu";
import SiteLinksFooter from "../../../../shared/components/SiteLinksFooter";
import { ChannelIconGlyph } from "../../../../shared/constants/channelIcons.jsx";
import { communitySegment } from "../../../../shared/services/entityLinks";
import { formatCount } from "../../../../shared/utils/format";
import { EXPLORE_PATH, FEED_PATH } from "../../../../shared/constants/paths";
import { APP_SCROLL_ID } from "../../../../shared/utils/scroll";

const SIDE_CARD =
  "bg-fo-surface border border-fo-border rounded-xl p-3 space-y-2 shadow-[0_1px_2px_rgba(26,22,18,0.04)]";

const CATEGORY_PREVIEW = 10;
const HAPPENING_PREVIEW = 5;

function RailCard({
  title,
  headerRight = null,
  open = true,
  onOpen,
  children,
}) {
  const collapsible = typeof onOpen === "function";

  return (
    <div className={SIDE_CARD}>
      <div className="flex items-center gap-2">
        {collapsible ? (
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={open}
            className="min-w-0 flex-1 flex items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
          >
            <ChevronDown
              size={16}
              aria-hidden
              className={`shrink-0 text-fo-subtle transition-transform ${
                open ? "rotate-0" : "-rotate-90"
              }`}
            />
            <h2 className="text-[13px] font-semibold text-fo-text truncate">
              {title}
            </h2>
          </button>
        ) : (
          <h2 className="min-w-0 flex-1 text-[13px] font-semibold text-fo-text truncate">
            {title}
          </h2>
        )}
        {headerRight}
      </div>
      {open ? children : null}
    </div>
  );
}

export function WhatsHappeningCard({
  topics = [],
  loading = false,
  open = true,
  onOpen,
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? topics : topics.slice(0, HAPPENING_PREVIEW);
  const hasMore = topics.length > HAPPENING_PREVIEW;

  return (
    <RailCard
      title="What's happening"
      open={open}
      onOpen={onOpen}
      headerRight={
        hasMore && open ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-fo-subtle hover:text-fo-accent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
          >
            {showAll ? "Show less" : "View all"}
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-fo-subtle py-1">
          <Loader2 size={12} className="animate-spin text-fo-accent" />
          Loading...
        </div>
      ) : topics.length === 0 ? (
        <p className="text-xs text-fo-subtle">Nothing trending yet.</p>
      ) : (
        <ol className="space-y-0.5">
          {visible.map((topic, index) => {
            const tag = topic.tag || "";
            const label = tag.startsWith("#") ? tag : `#${tag}`;
            return (
              <li key={label}>
                <Link
                  to={`/search?q=${encodeURIComponent(label)}`}
                  className="flex items-center gap-2 px-1 py-1.5 rounded-lg text-[13px] text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <span className="w-6 h-6 rounded-full bg-fo-accent/15 text-fo-accent text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fo-text font-medium">
                      {label}
                    </span>
                    <span className="block text-[11px] text-fo-subtle">
                      {formatCount(topic.postCount)}{" "}
                      {topic.postCount === 1 ? "post" : "posts"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </RailCard>
  );
}

function CategoryIcon({ channel, active }) {
  const tone = active
    ? "bg-fo-accent/15 text-fo-accent"
    : "bg-fo-surface-2 text-fo-subtle";

  if (channel?.icon) {
    return (
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
      >
        <ChannelIconGlyph icon={channel.icon} size={14} />
      </span>
    );
  }

  const letter = (channel?.name || "?")[0].toUpperCase();
  return (
    <span
      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-semibold ${tone}`}
    >
      {letter}
    </span>
  );
}

export function CategoryList({
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
  open = true,
  onOpen,
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? channels : channels.slice(0, CATEGORY_PREVIEW);
  const hasMore = channels.length > CATEGORY_PREVIEW;

  return (
    <RailCard
      title="Categories"
      open={open}
      onOpen={onOpen}
      headerRight={
        <Link
          to="/communities"
          className="text-xs text-fo-subtle hover:text-fo-accent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
        >
          View all
        </Link>
      }
    >
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
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-[13px] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                      active
                        ? "bg-fo-accent/12 text-fo-accent"
                        : "text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
                    }`}
                  >
                    <CategoryIcon channel={ch} active={active} />
                    <span className="truncate flex-1">{name}</span>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-fo-subtle"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-fo-accent hover:text-fo-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg"
            >
              {showAll
                ? "Show less"
                : `Show more (${channels.length - CATEGORY_PREVIEW})`}
            </button>
          ) : null}
        </>
      )}
    </RailCard>
  );
}

function CommunityThumb({ community }) {
  const name = community?.name || "Community";
  if (community?.coverImage) {
    return (
      <img
        src={community.coverImage}
        alt=""
        className="w-9 h-9 rounded-lg object-cover border border-fo-border shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-fo-surface-3 border border-fo-border flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-fo-accent/70">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function OtherCommunitiesCard({
  communities = [],
  loading = false,
  open = true,
  onOpen,
}) {
  return (
    <RailCard
      title="Suggested Communities"
      open={open}
      onOpen={onOpen}
      headerRight={
        <Link
          to="/communities"
          className="text-xs text-fo-subtle hover:text-fo-accent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
        >
          View all
        </Link>
      }
    >
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
                  className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-[13px] text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <CommunityThumb community={community} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fo-text font-medium">
                      {community.name || "Community"}
                    </span>
                    {typeof community.memberCount === "number" ? (
                      <span className="block text-[11px] text-fo-subtle">
                        {formatCount(community.memberCount)} members
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-fo-subtle"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </RailCard>
  );
}

export function FeedFilterToggle({ open, active, onClick, controlsId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lg:hidden inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-full border text-[13px] font-medium transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
        open || active
          ? "border-fo-accent/45 text-fo-accent bg-fo-accent/10"
          : "border-fo-border text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
      }`}
      title="Filters"
      aria-label={open ? "Close filters" : "Open filters"}
      aria-expanded={open}
      aria-controls={controlsId || undefined}
    >
      <Filter size={15} aria-hidden />
      Filter
      {active ? (
        <span className="w-1.5 h-1.5 rounded-full bg-fo-accent" />
      ) : null}
    </button>
  );
}

export function FeedMobileFilters({
  open,
  onClose,
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
  communities,
  communitiesLoading,
  trendingTopics,
  trendingLoading,
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
        id="feed-filters-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-filters-title"
        className="relative w-full max-h-[85vh] rounded-t-2xl bg-fo-bg border-t border-fo-border shadow-[0_-12px_40px_rgba(26,22,18,0.18)] flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-fo-border" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-fo-border">
          <h2
            id="feed-filters-title"
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
        <div className="overflow-y-auto fointer-scrollbar p-3 space-y-3">
          <WhatsHappeningCard
            topics={trendingTopics}
            loading={trendingLoading}
          />
          <CategoryList
            channels={channels}
            channelsLoading={channelsLoading}
            selectedChannel={selectedChannel}
            onSelectChannel={onSelectChannel}
          />
          <OtherCommunitiesCard
            communities={communities}
            loading={communitiesLoading}
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
          <h2 className="text-[13px] font-semibold text-fo-text leading-snug">
            Join the conversation on Fointer
          </h2>
          <p className="text-xs text-fo-subtle leading-relaxed">
            Log in to like, comment, join communities, and create live events or
            watch groups.
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 min-h-9 px-3 py-2 rounded-xl bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            <UserPlus size={14} aria-hidden /> Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: loginFrom }}
            className="w-full inline-flex items-center justify-center gap-2 min-h-9 px-3 py-2 rounded-xl border border-fo-border text-fo-text text-xs font-semibold hover:border-fo-accent/40 hover:text-fo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
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
  const [openPanel, setOpenPanel] = useState("happening");

  return (
    <aside className="space-y-3" aria-label="Feed sidebar">
      <WhatsHappeningCard
        topics={props.trendingTopics}
        loading={props.trendingLoading}
        open={openPanel === "happening"}
        onOpen={() => setOpenPanel("happening")}
      />
      <CategoryList
        {...props}
        open={openPanel === "categories"}
        onOpen={() => setOpenPanel("categories")}
      />
      <OtherCommunitiesCard
        communities={props.communities}
        loading={props.communitiesLoading}
        open={openPanel === "communities"}
        onOpen={() => setOpenPanel("communities")}
      />
      <FeedFooterRail isGuest={props.isGuest} />
    </aside>
  );
}
