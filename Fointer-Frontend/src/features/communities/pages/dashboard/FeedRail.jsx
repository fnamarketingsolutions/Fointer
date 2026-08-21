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
import { EXPLORE_PATH } from "../../../../shared/constants/paths";

const SIDE_CARD =
  "bg-[#14100D] border border-[#2A241E] rounded-xl p-3 space-y-2";

export function CategoryList({
  channels,
  channelsLoading,
  selectedChannel,
  onSelectChannel,
}) {
  return (
    <div className={SIDE_CARD}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#E5E0D8]">
          <Hash size={15} className="text-[#D4AF37]" />
          Categories
        </div>
        {selectedChannel ? (
          <button
            type="button"
            onClick={() => onSelectChannel("")}
            className="text-[10px] text-[#8C8070] hover:text-[#D4AF37]"
          >
            Clear
          </button>
        ) : null}
      </div>
      {channelsLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8070] py-1">
          <Loader2 size={12} className="animate-spin text-[#D4AF37]" />
          Loading...
        </div>
      ) : channels.length === 0 ? (
        <p className="text-xs text-[#8C8070]">No categories yet.</p>
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
                      ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                      : "text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#1C1612]"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[10px] text-[#D4AF37] font-bold shrink-0">
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
        className="w-8 h-8 rounded-lg object-cover border border-[#2A241E] shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-[#1A1510] border border-[#2A241E] flex items-center justify-center shrink-0">
      <span className="text-[11px] font-semibold text-[#D4AF37]/70">
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
        <div className="flex items-center gap-2 text-sm font-semibold text-[#E5E0D8]">
          <Users size={15} className="text-[#D4AF37]" />
          Other communities
        </div>
        <Link
          to="/communities"
          className="text-[10px] text-[#8C8070] hover:text-[#D4AF37] shrink-0"
        >
          See all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8070] py-1">
          <Loader2 size={12} className="animate-spin text-[#D4AF37]" />
          Loading...
        </div>
      ) : communities.length === 0 ? (
        <p className="text-xs text-[#8C8070]">No other communities yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {communities.map((community) => {
            const segment = communitySegment(community) || community.id;
            return (
              <li key={community.id || segment}>
                <Link
                  to={`/communities/${segment}`}
                  className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#1C1612] transition-colors"
                >
                  <CommunityThumb community={community} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[#E5E0D8]">
                      {community.name || "Community"}
                    </span>
                    {typeof community.memberCount === "number" ? (
                      <span className="block text-[10px] text-[#8C8070]">
                        {formatCount(community.memberCount)} members
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight size={12} className="shrink-0 text-[#5C5348]" />
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
          ? "border-[#D4AF37]/45 text-[#D4AF37] bg-[#D4AF37]/10"
          : "border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37]"
      }`}
      title="Filters"
      aria-expanded={open}
    >
      <Filter size={16} />
      {active ? (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
      ) : null}
    </button>
  );
}

export function FeedFooterRail({ isGuest }) {
  const loginFrom = isGuest ? EXPLORE_PATH : "/";
  return (
    <div className="space-y-3">
      {isGuest ? (
        <div className={SIDE_CARD}>
          <h3 className="text-sm font-semibold text-[#E5E0D8] leading-snug">
            Join the conversation on Fointer
          </h3>
          <p className="text-xs text-[#8C8070] leading-relaxed">
            Log in to like, comment, join communities, and create live events or
            watch groups.
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]"
          >
            <UserPlus size={14} /> Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: loginFrom }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#2A241E] text-[#E5E0D8] text-xs font-semibold hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
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