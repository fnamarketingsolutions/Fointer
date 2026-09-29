import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuX as X,
} from "react-icons/lu";

export default function MarketplaceImageViewer({
  media = [],
  initialIndex = 0,
  onClose,
  onIndexChange,
}) {
  const items = media.filter((item) => item?.url);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0))
  );

  const count = items.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const current = items[safeIndex];
  const canScroll = count > 1;
  const onCloseRef = useRef(onClose);
  const onIndexChangeRef = useRef(onIndexChange);

  useEffect(() => {
    onCloseRef.current = onClose;
    onIndexChangeRef.current = onIndexChange;
  });

  const go = (next) => {
    setIndex(next);
    onIndexChangeRef.current?.(next);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (count < 2) return;
      if (event.key === "ArrowLeft") {
        setIndex((value) => {
          const next = (value - 1 + count) % count;
          onIndexChangeRef.current?.(next);
          return next;
        });
      }
      if (event.key === "ArrowRight") {
        setIndex((value) => {
          const next = (value + 1) % count;
          onIndexChangeRef.current?.(next);
          return next;
        });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [count]);

  if (!current || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Full screen image"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        onClick={onClose}
        aria-label="Close full screen image"
      />
      <div className="relative z-10 flex h-full w-full items-center justify-center pointer-events-none p-4 sm:p-8">
        {current.type === "video" ? (
          <video
            src={current.url}
            controls
            autoPlay
            className="pointer-events-auto max-h-full max-w-full"
          />
        ) : (
          <img
            src={current.url}
            alt=""
            className="pointer-events-auto max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label="Close"
      >
        <X size={22} />
      </button>
      {canScroll ? (
        <>
          <button
            type="button"
            onClick={() => go((safeIndex - 1 + count) % count)}
            className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => go((safeIndex + 1) % count)}
            className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
          <span className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium">
            {safeIndex + 1} / {count}
          </span>
        </>
      ) : null}
    </div>,
    document.body
  );
}
