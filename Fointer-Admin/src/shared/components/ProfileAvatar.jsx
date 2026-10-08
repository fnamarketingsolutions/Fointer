import { useEffect, useState } from "react";
import {
  getNameInitials,
  initialsTextClass,
} from "../utils/nameInitials";

export default function ProfileAvatar({
  src,
  alt,
  name,
  className = "w-9 h-9 rounded-full object-cover border border-fo-border shrink-0",
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const label = alt || name || "User";
  const initials = getNameInitials(name || alt, "?");
  const showImage = Boolean(src) && !failed;

  if (!showImage) {
    const fallbackClass = String(className || "")
      .replace(/\bobject-cover\b/g, "")
      .trim();
    return (
      <div
        role="img"
        aria-label={label}
        title={label}
        className={`${fallbackClass} bg-fo-accent/15 border-fo-accent/30 flex items-center justify-center text-fo-accent font-semibold uppercase select-none ${initialsTextClass(className)}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
