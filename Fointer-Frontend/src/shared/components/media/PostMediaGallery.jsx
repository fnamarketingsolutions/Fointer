import React, { useRef, useState } from "react";

function MediaFrame({ item, heightClass }) {
  const frameClass = `w-full ${heightClass} bg-fo-surface-2 flex items-center justify-center overflow-hidden`;
  const mediaClass = "w-full h-full object-contain";

  if (item.type === "video") {
    return (
      <div className={`${frameClass} bg-black`}>
        <video src={item.url} controls className={mediaClass} />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <img src={item.url} alt="" className={mediaClass} />
    </div>
  );
}

export default function PostMediaGallery({
  media = [],
  counterOverlay = false,
  heightClass = "h-64 sm:h-80",
}) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media.length) {
    return (
      <div className="h-40 bg-gradient-to-br from-fo-surface-3 to-fo-bg" />
    );
  }

  if (media.length === 1) {
    return <MediaFrame item={media[0]} heightClass={heightClass} />;
  }

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    if (slideWidth <= 0) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.min(index, media.length - 1));
  };

  return (
    <div className="relative">
      {counterOverlay && (
        <div className="absolute top-3 right-3 z-10 rounded-full border border-white/25 bg-black/80 px-2.5 py-1 text-[10px] font-mono text-white shadow-sm backdrop-blur-sm">
          {activeIndex + 1} / {media.length}
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-fo-border scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {media.map((m, idx) => (
          <div
            key={`${m.url}-${idx}`}
            className="min-w-full shrink-0 snap-center"
          >
            <MediaFrame item={m} heightClass={heightClass} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2 bg-fo-bg/80">
        {media.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Go to slide ${idx + 1}`}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
              setActiveIndex(idx);
            }}
            className={`h-1.5 rounded-full transition-all ${
              idx === activeIndex
                ? "w-4 bg-fo-accent"
                : "w-1.5 bg-fo-border hover:bg-fo-subtle"
            }`}
          />
        ))}
        {!counterOverlay && (
          <span className="ml-2 text-[10px] text-fo-subtle font-mono">
            {activeIndex + 1} / {media.length}
          </span>
        )}
      </div>
    </div>
  );
}
