import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuX as Close,
} from "react-icons/lu";
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

function MediaFrame({
  item,
  heightClass,
  autoPlayOnView = false,
  active = true,
  onImageClick,
}) {
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
      <button
        type="button"
        onClick={onImageClick}
        className="absolute inset-0 block h-full w-full cursor-zoom-in"
        aria-label="View image full screen"
      >
        <img src={item.url} alt="" className={mediaClass} />
      </button>
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
  const [fullScreenIndex, setFullScreenIndex] = useState(null);
  const photos = media.filter((item) => item.type !== "video");

  useEffect(() => {
    if (fullScreenIndex === null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFullScreenIndex(null);
      if (event.key === "ArrowRight") {
        setFullScreenIndex((index) => (index + 1) % photos.length);
      }
      if (event.key === "ArrowLeft") {
        setFullScreenIndex(
          (index) => (index - 1 + photos.length) % photos.length
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullScreenIndex, photos.length]);

  if (!media.length) return null;

  if (media.length === 1) {
    return (
      <>
        <MediaFrame
          item={media[0]}
          heightClass={heightClass}
          autoPlayOnView={autoPlayOnView}
          onImageClick={
            media[0].type === "video" ? undefined : () => setFullScreenIndex(0)
          }
        />
        {fullScreenIndex !== null &&
          createPortal(
            <FullScreenImageViewer
              photos={photos}
              index={fullScreenIndex}
              onClose={() => setFullScreenIndex(null)}
              onChange={setFullScreenIndex}
            />,
            document.body
          )}
      </>
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
              onImageClick={
                m.type === "video"
                  ? undefined
                  : () =>
                      setFullScreenIndex(
                        media.slice(0, idx + 1).filter((item) => item.type !== "video")
                          .length - 1
                      )
              }
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
      {fullScreenIndex !== null &&
        createPortal(
          <FullScreenImageViewer
            photos={photos}
            index={fullScreenIndex}
            onClose={() => setFullScreenIndex(null)}
            onChange={setFullScreenIndex}
          />,
          document.body
        )}
    </div>
  );
}

function FullScreenImageViewer({ photos, index, onClose, onChange }) {
  const photo = photos[index];
  if (!photo) return null;

  const hasMultiple = photos.length > 1;
  const showPrevious = () =>
    onChange((current) => (current - 1 + photos.length) % photos.length);
  const showNext = () =>
    onChange((current) => (current + 1) % photos.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen image viewer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close full-screen image"
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Close size={22} />
      </button>
      {hasMultiple ? (
        <>
          <button
            type="button"
            onClick={showPrevious}
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="Next image"
            className="absolute right-2 sm:right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight size={24} />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {photos.length}
          </span>
        </>
      ) : null}
      <img
        src={photo.url}
        alt=""
        className="max-h-full max-w-full select-none object-contain"
      />
    </div>
  );
}
