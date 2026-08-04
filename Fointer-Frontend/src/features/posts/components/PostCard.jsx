import React from "react";
import {
  Heart,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";

export default function PostCard({ post, onClick }) {
  const cover =
    post?.media?.find((m) => m.type === "image") || post?.media?.[0] || null;
  const authorName =
    post?.author?.name || post?.author?.username || "Unknown author";

  return (
    <article
      onClick={onClick}
      className={`group relative flex flex-col rounded-2xl bg-[#0D0A08] border border-[#221C17] hover:border-[#D4AF37]/40 transition-all duration-300 overflow-hidden shadow-lg ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative w-full h-40 sm:h-44 bg-[#18130E] overflow-hidden">
        {cover ? (
          cover.type === "video" ? (
            <video
              src={cover.url}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              muted
              playsInline
            />
          ) : (
            <img
              src={cover.url}
              alt={post?.title || ""}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1C1712] via-[#2A2119] to-[#0D0A08] flex items-center justify-center text-[#5A5046]">
            <ImageIcon size={32} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A08] via-black/20 to-black/40" />
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex-1 space-y-2">
          <p className="text-[10px] font-medium tracking-wider text-[#8C8070] uppercase truncate">
            {authorName}
          </p>
          <h3 className="font-serif font-bold text-base sm:text-lg text-[#E5E0D8] line-clamp-2 leading-snug">
            {post?.title || "Untitled"}
          </h3>
          <p className="text-xs sm:text-sm text-[#A69B8D] line-clamp-3">
            {post?.text || "No description"}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#2A241E]/60 text-[11px] text-[#8C8070]">
          <span className="inline-flex items-center gap-1">
            <Heart size={11} /> {post?.likeCount || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} /> {post?.commentCount || 0}
          </span>
        </div>
      </div>
    </article>
  );
}
