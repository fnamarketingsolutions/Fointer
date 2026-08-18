import React from "react";

export default function PostAuthorAvatar({ author, size = "md" }) {
  const name = author?.name || author?.username || "Member";
  const initial = name.charAt(0).toUpperCase();
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

  if (author?.avatar) {
    return (
      <img
        src={author.avatar}
        alt=""
        className={`${sizeClass} rounded-full object-cover border border-[#2A241E] shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-semibold shrink-0`}
    >
      {initial}
    </div>
  );
}
