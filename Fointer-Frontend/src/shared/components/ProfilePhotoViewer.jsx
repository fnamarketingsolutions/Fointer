import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LuX as X } from "react-icons/lu";
import { displayImageUrl } from "../utils/imageUrl";

export default function ProfilePhotoViewer({ src, alt, onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close profile photo"
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={22} />
      </button>
      <img
        src={displayImageUrl(src, 1600)}
        alt={alt || "Profile photo"}
        className="h-[100dvh] w-[100vw] select-none object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body
  );
}
