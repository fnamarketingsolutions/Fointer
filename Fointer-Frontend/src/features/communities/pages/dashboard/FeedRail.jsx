import { Link } from "react-router-dom";
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

export function CategoryList({
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
}) {
  return (
    <div className={SIDE_CARD}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
          <Hash size={15} className="text-fo-accent" />
          Categories
        </div>
        {selectedChannel ? (
          <button
            type="button"
            onClick={() => onSelectChannel("")}
            className="text-[10px] text-fo-subtle hover:text-fo-accent"
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
        <ul className="space-y-0.5">
          {channels.slice(0, 12).map((ch) => {
            const name = ch.name || "";
            const active =
              selectedChannel.toLowerCase() === name.toLowerCase();
            return (
              <li key={ch.id || name}>
                <button
                  type="button"
                  onClick={() => onSelectChannel(active ? "" : name)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
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
    <div className="w-8 h-8 rounded-lg bg-[#1A1510] border border-fo-border flex items-center justify-center shrink-0">
      <span className="text-[11px] font-semibold text-fo-accent/70">
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
          <Users size={15} className="text-fo-accent" />
          Other communities
        </div>
        <Link
          to="/communities"
          className="text-[10px] text-fo-subtle hover:text-fo-accent shrink-0"
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
                  className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs text-fo-muted hover:text-fo-accent hover:bg-fo-surface-hover transition-colors"
                >
                  <CommunityThumb community={community} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fo-text">
                      {community.name || "Community"}
                    </span>
                    {typeof community.memberCount === "number" ? (
                      <span className="block text-[10px] text-fo-subtle">
                        {formatCount(community.memberCount)} members
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight size={12} className="shrink-0 text-fo-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FeedFilterToggle({ open, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lg:hidden relative p-2 rounded-lg border transition-colors shrink-0 ${
        open || active
          ? "border-fo-accent/45 text-fo-accent bg-fo-accent/10"
          : "border-fo-border text-fo-muted hover:text-fo-accent"
      }`}
      title="Filters"
      aria-expanded={open}
    >
      <Filter size={16} />
      {active ? (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-fo-accent" />
      ) : null}
    </button>
  );
}

export function FeedFooterRail({ isGuest }) {
  const loginFrom = isGuest ? EXPLORE_PATH : FEED_PATH;
  return (
    <div className="space-y-3">
      {isGuest ? (
        <div className={SIDE_CARD}>
          <h3 className="text-sm font-semibold text-fo-text leading-snug">
            Join the conversation on Fointer
          </h3>
          <p className="text-xs text-fo-subtle leading-relaxed">
            Log in to like, comment, join communities, and create live events or
            watch groups.
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover"
          >
            <UserPlus size={14} /> Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: loginFrom }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-fo-border text-fo-text text-xs font-semibold hover:border-fo-accent/40 hover:text-fo-accent"
          >
            <LogIn size={14} /> Log in
          </Link>
        </div>
      ) : null}

      <SiteLinksFooter className="pt-0.5" />
    </div>
  );
}

export function FeedDesktopRail(props) {
  return (
    <aside className="space-y-3">
      <CategoryList {...props} />
      <OtherCommunitiesCard
        communities={props.communities}
        loading={props.communitiesLoading}
      />
      <FeedFooterRail isGuest={props.isGuest} />
    </aside>
  );
}