import { useEffect, useRef, useState } from "react";
import { APP_SCROLL_ID } from "../../utils/scroll";
import {
  registerFeedVideo,
  updateFeedVideoRatio,
} from "../../utils/feedVideoAutoplay";

function AutoplaysVideo({ item, heightClass, active = true }) {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const userPausedRef = useRef(false);
  const observerPausedRef = useRef(false);
  const playerRef = useRef({
    ratio: 0,
    play: () => {},
    pause: () => {},
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const player = playerRef.current;
    player.play = () => {
      if (userPausedRef.current) return;
      if (!video.paused) return;
      video.muted = true;
      const playAttempt = video.play();
      if (playAttempt?.catch) playAttempt.catch(() => {});
    };
    player.pause = () => {
      userPausedRef.current = false;
      if (video.paused) {
        video.muted = true;
        return;
      }
      observerPausedRef.current = true;
      video.pause();
      video.muted = true;
    };

    const unregister = registerFeedVideo(player);
    return () => {
      unregister();
    };
  }, [item.url]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const player = playerRef.current;
    if (!active) {
      updateFeedVideoRatio(player, 0);
      return undefined;
    }

    const root = document.getElementById(APP_SCROLL_ID) || null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        updateFeedVideoRatio(player, entry?.intersectionRatio || 0);
      },
      {
        root,
        threshold: [0, 0.25, 0.5, 0.55, 0.75, 1],
      }
    );
    observer.observe(frame);
    return () => {
      observer.disconnect();
      updateFeedVideoRatio(player, 0);
    };
  }, [active, item.url]);

  return (
    <div ref={frameRef} className={heightClass}>
      <video
        ref={videoRef}
        src={item.url}
        className="absolute inset-0 w-full h-full object-contain"
        preload="metadata"
        playsInline
        loop
        muted
        controls
        onPause={() => {
          if (observerPausedRef.current) {
            observerPausedRef.current = false;
            return;
          }
          userPausedRef.current = true;
        }}
        onPlay={() => {
          userPausedRef.current = false;
        }}
      />
    </div>
  );
}

function MediaFrame({ item, heightClass, autoPlayOnView = false, active = true }) {
  const isVideo = item.type === "video";
  const frameClass = `relative w-full ${heightClass} bg-fo-surface-2 overflow-hidden`;
  const mediaClass = "absolute inset-0 w-full h-full object-contain";

  if (isVideo && autoPlayOnView) {
    return (
      <div className={frameClass}>
        <AutoplaysVideo
          item={item}
          heightClass="absolute inset-0"
          active={active}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={frameClass}>
        <video
          src={item.url}
          controls
          className={mediaClass}
          preload="metadata"
          playsInline
        />
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
  heightClass = "aspect-video",
  autoPlayOnView = false,
}) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media.length) return null;

  if (media.length === 1) {
    return (
      <MediaFrame
        item={media[0]}
        heightClass={heightClass}
        autoPlayOnView={autoPlayOnView}
      />
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
        <div className="absolute top-3 right-3 z-10 rounded-full border border-white/25 bg-black/80 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
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
            <MediaFrame
              item={m}
              heightClass={heightClass}
              autoPlayOnView={autoPlayOnView}
              active={idx === activeIndex}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2">
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
      </div>
    </div>
  );
}
