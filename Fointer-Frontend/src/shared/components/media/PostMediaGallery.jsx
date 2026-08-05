import React, { useRef, useState } from "react";

export default function PostMediaGallery({
  media = [],
  counterOverlay = false,
  heightClass = "max-h-96",
}) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media.length) {
    return (
      <div className="h-40 bg-gradient-to-br from-[#251E17] to-[#0E0C0A]" />
    );
  }

  if (media.length === 1) {
    const item = media[0];
    return item.type === "video" ? (
      <video
        src={item.url}
        controls
        className={`w-full ${heightClass} bg-black object-contain`}
      />
    ) : (
      <img src={item.url} alt="" className={`w-full ${heightClass} object-cover`} />
    );
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
        <div className="absolute top-3 right-3 z-10 rounded-full border border-[#2A241E] bg-black/70 px-2.5 py-1 text-[10px] font-mono text-[#E5E0D8] backdrop-blur-sm">
          {activeIndex + 1} / {media.length}
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#2A241E] scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {media.map((m, idx) => (
          <div
            key={`${m.url}-${idx}`}
            className="min-w-full shrink-0 snap-center"
          >
            {m.type === "video" ? (
              <video
                src={m.url}
                controls
                className={`w-full ${heightClass} bg-black object-contain`}
              />
            ) : (
              <img
                src={m.url}
                alt=""
                className={`w-full ${heightClass} object-cover`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2 bg-[#0E0C0A]/80">
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
                ? "w-4 bg-[#D4AF37]"
                : "w-1.5 bg-[#2A241E] hover:bg-[#4A4036]"
            }`}
          />
        ))}
        {!counterOverlay && (
          <span className="ml-2 text-[10px] text-[#8C8070] font-mono">
            {activeIndex + 1} / {media.length}
          </span>
        )}
      </div>
    </div>
  );
}
