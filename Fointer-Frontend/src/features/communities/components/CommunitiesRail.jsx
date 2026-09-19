import { Link } from "react-router-dom";
import { LuFolders as Folders, LuUsers as Users } from "react-icons/lu";
import { FeedFooterRail } from "../pages/dashboard/FeedRail";

const SIDE_CARD =
  "bg-fo-surface border border-fo-border rounded-xl p-3 space-y-2 shadow-[0_1px_2px_rgba(26,22,18,0.04)]";

export default function CommunitiesRail({
  items = [],
  selectedId = "",
  onSelect,
  isGuest = false,
  managePage = false,
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
