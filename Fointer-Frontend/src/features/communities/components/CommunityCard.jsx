import React from "react";
import {
  Users,
  Lock,
  Globe,
  ShieldCheck,
  UserPlus,
  Loader2,
  Image as ImageIcon,
  Calendar,
} from "lucide-react";
import { formatDate } from "../../../shared/utils/date";
import { COMMUNITY_TYPE_LABELS } from "../../../shared/constants/community";

const TYPE_META = {
  public: { label: COMMUNITY_TYPE_LABELS.public, icon: Globe },
  private_invite: { label: COMMUNITY_TYPE_LABELS.private_invite, icon: ShieldCheck },
  private_request: { label: COMMUNITY_TYPE_LABELS.private_request, icon: Lock },
};

export default function CommunityCard({
  community,
  showJoin = false,
  busy = false,
  onJoin,
  onClick,
  roleLabel,
}) {
  const meta = TYPE_META[community.type] || TYPE_META.public;
  const TypeIcon = meta.icon;
  const pending = community.joinRequestPending;
  const ownerName =
    community.owner?.name || community.owner?.username || "Community Owner";
  const galleryCount = community.galleryImages?.length || 0;

  return (
    <article
      onClick={onClick}
      className={`group relative flex flex-col rounded-2xl bg-[#0D0A08] border border-[#221C17] hover:border-[#D4AF37]/40 transition-all duration-300 overflow-hidden shadow-lg ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative w-full h-40 sm:h-44 bg-[#18130E] overflow-hidden">
        {community.coverImage ? (
          <img
            src={community.coverImage}
            alt={community.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1C1712] via-[#2A2119] to-[#0D0A08] flex items-center justify-center">
            <span className="text-4xl sm:text-5xl font-serif font-bold text-[#D4AF37]/30">
              {(community.name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A08] via-black/20 to-black/50" />

        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#D4AF37]/40 text-[10px] sm:text-[11px] font-medium text-[#D4AF37]">
            <TypeIcon size={11} />
            {meta.label}
          </span>
        </div>

        {galleryCount > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 text-[10px] text-[#A69B8D]">
            <ImageIcon size={10} />
            {galleryCount} photos
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex-1">
          {community.tags?.[0] && (
            <p className="text-[10px] font-bold tracking-widest text-[#D4AF37] uppercase mb-1">
              {community.tags[0]}
            </p>
          )}

          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#E5E0D8] mb-1.5 truncate group-hover:text-[#D4AF37] transition-colors">
            {community.name}
          </h3>

          <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-2 leading-relaxed min-h-[2.5rem]">
            {community.description || "No description available"}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-[#8C8070]">
            <span className="truncate">by {ownerName}</span>
            {community.createdAt && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Calendar size={10} />
                {formatDate(community.createdAt)}
              </span>
            )}
          </div>
        </div>

        <div className="pt-4 mt-3 border-t border-[#221C17] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-[#A69B8D] font-medium">
            <Users size={14} className="text-[#8C8070]" />
            {community.memberCount ?? 0} members
          </span>

          {showJoin && (
            pending ? (
              <span className="text-[11px] text-amber-400 font-semibold shrink-0">
                Pending
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin?.();
                }}
                className="inline-flex items-center gap-1 text-xs text-[#D4AF37] font-semibold hover:underline disabled:opacity-60 shrink-0"
              >
                {busy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UserPlus size={12} />
                )}
                {community.type === "public" ? "Join" : "Request to Join"}
              </button>
            )
          )}

          {roleLabel && (
            <span className="text-[10px] text-[#8C8070] uppercase tracking-wider font-semibold shrink-0">
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
