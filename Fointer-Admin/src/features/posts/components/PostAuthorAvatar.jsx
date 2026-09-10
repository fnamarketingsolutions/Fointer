import React from "react";
import UserProfileLink from "../../../shared/components/UserProfileLink";

export default function PostAuthorAvatar({
  author,
  size = "md",
  linkable = true,
}) {
  const name = author?.name || author?.username || "Member";
  const initial = name.charAt(0).toUpperCase();
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

  const avatar = author?.avatar ? (
    <img
      src={author.avatar}
      alt=""
      className={`${sizeClass} rounded-full object-cover border border-fo-border shrink-0`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full bg-fo-accent/15 border border-fo-accent/30 flex items-center justify-center text-fo-accent font-semibold shrink-0`}
    >
      {initial}
    </div>
  );

  if (!linkable || !author?.username) return avatar;

  return (
    <UserProfileLink
      author={author}
      className="inline-flex shrink-0 rounded-full hover:opacity-85 transition-opacity"
    >
      {avatar}
    </UserProfileLink>
  );
}
