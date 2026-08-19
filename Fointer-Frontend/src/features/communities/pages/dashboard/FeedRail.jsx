import { Link } from "react-router-dom";
import {
  LuFilter as Filter,
  LuHash as Hash,
  LuLoaderCircle as Loader2,
  LuLogIn as LogIn,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import SiteLinksFooter from "../../../../shared/components/SiteLinksFooter";

const FEED_PATH = "/";

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
            state={{ from: FEED_PATH }}
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
      <FeedFooterRail isGuest={props.isGuest} />
    </aside>
  );
}