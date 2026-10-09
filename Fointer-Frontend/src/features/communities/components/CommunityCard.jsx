import { LuUsers as Users } from "react-icons/lu";
import { COMMUNITY_TYPE_LABELS } from "../../../shared/constants/community";
import { displayImageUrl } from "../../../shared/utils/imageUrl";

export default function CommunityCard({
  community,
  onClick,
  badge = "",
  meta = null,
  action = null,
  priority = false,
}) {
  const name = community?.name || "Community";
  const cover = community?.coverImage;
  const typeLabel =
    COMMUNITY_TYPE_LABELS[community?.type] || community?.type || "";

  const open = () => onClick?.(community);

  return (
    <div
      className="group text-left rounded-xl border border-fo-border bg-fo-surface overflow-hidden hover:border-fo-accent/40 transition-colors cursor-pointer"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="relative w-full pt-[56.25%] bg-fo-surface-2 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fo-accent/40"
      >
        {cover ? (
          <img
            src={displayImageUrl(cover, 640)}
            alt=""
            width={640}
            height={360}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-fo-surface-3">
            <span className="text-2xl font-semibold text-fo-accent/50">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {badge ? (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wide">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-3 space-y-1.5">
        <button
          type="button"
          onClick={open}
          className="w-full text-left space-y-1.5 focus-visible:outline-none"
        >
          <h2 className="text-[13px] font-semibold text-fo-text group-hover:text-fo-accent line-clamp-2 leading-snug">
            {name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fo-muted">
            {typeLabel ? <span>{typeLabel}</span> : null}
            {typeof community?.memberCount === "number" ? (
              <span className="inline-flex items-center gap-1">
                <Users size={11} aria-hidden />
                {community.memberCount}
              </span>
            ) : null}
            {meta}
          </div>
        </button>
        {action}
      </div>
    </div>
  );
}
